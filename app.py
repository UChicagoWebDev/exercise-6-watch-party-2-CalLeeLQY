import string
import random
from datetime import datetime
from flask import *
from functools import wraps
import sqlite3
import traceback

app = Flask(__name__, template_folder='.')
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.secret_key = 'LQY'

def get_db():
    db = getattr(g, '_database', None)

    if db is None:
        db = g._database = sqlite3.connect('db/watchparty.sqlite3')
        db.row_factory = sqlite3.Row
        setattr(g, '_database', db)
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    db = get_db()
    cursor = db.execute(query, args)
    rows = cursor.fetchall()
    db.commit()
    cursor.close()
    if rows:
        if one: 
            return rows[0]
        return rows
    return None

def new_user():
    name = "Unnamed User #" + ''.join(random.choices(string.digits, k=6))
    password = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    api_key = ''.join(random.choices(string.ascii_lowercase + string.digits, k=40))
    u = query_db('insert into users (name, password, api_key) ' + 
        'values (?, ?, ?) returning id, name, password, api_key',
        (name, password, api_key),
        one=True)
    return u

def get_api_key(userid):
    api_key = query_db(f"SELECT api_key FROM users WHERE id = {userid}")
    return api_key[0][0]

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('Api-Key')
        print("GETapi",request.cookies.get('api_key'))
        print(api_key)
        if not api_key or api_key != request.cookies.get('api_key'):  # 确保这里是实际的 API 密钥
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function


# TODO: If your app sends users to any other routes, include them here.
#       (This should not be necessary).
@app.route('/')
@app.route('/profile')
@app.route('/login')
@app.route('/room')
@app.route('/rooms/<chat_id>')
def index(chat_id=None):
    return app.send_static_file('index.html')

@app.errorhandler(404)
def page_not_found(e):
    return app.send_static_file('404.html'), 404

# -------------------------------- API ROUTES ----------------------------------

# TODO: Create the API
@app.route('/api/signup', methods=['POST'])
def signup():
    user = dict(new_user())
    response = jsonify(api_key = user['api_key'], name = user['name'], password = user['password'])
    response.set_cookie('api_key', user['api_key'])
    response.set_cookie('user_id', str(user['id']))
    response.set_cookie('name', str(user['name']))
    # print('id:', str(user['id']))
    print("api:", user['api_key'])
    cookies = request.cookies
    # print("Received Cookies:")
    # for key, value in cookies.items():
    #     print(f"{key}: {value}")
    return response, 201

@app.route('/api/login', methods=['GET'])
def login():
    username = request.headers.get('Username')
    password = request.headers.get('Password')
    print(username)
    print(password)
    uid = query_db('select id from users where name = ? and password = ?', [username, password], one=True)[0]
    # for u in query_db('select * from users' ):
    #     print(dict(u))
    if uid is None:
        return jsonify({'error': 'User not found'}), 401
    api = get_api_key(uid)
    response = jsonify(
        api_key = api,
    )
    
    # response = jsonify(api_key = api, name = username)
    response.set_cookie('api_key', api)
    response.set_cookie('user_id', str(uid))
    response.set_cookie('name', username)
    return response

@app.route('/api/logout', methods=['POST'])
@require_api_key
def logout():
    session.pop('api_key', None)  # Remove the API key from session
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/api/user/name', methods=['POST'])
@require_api_key
def update_username():
    user_id = request.cookies.get('user_id')
    new_username = request.json.get('new_username')
    if not user_id or not new_username:
        return jsonify({"error": "Missing user ID or new username"}), 400
    try:
        query_db("UPDATE users SET name = ? WHERE id = ?", [new_username, user_id])
        return jsonify({"success": "Username updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/user/password', methods=['POST'])
@require_api_key
def update_password():
    user_id = request.cookies.get('user_id')
    new_password = request.json.get('new_password')
    if not user_id or not new_password:
        return jsonify({"error": "Missing user ID or new password"}), 400
    try:
        query_db("UPDATE users SET password = ? WHERE id = ?", [new_password, user_id])
        response = make_response(jsonify({"success": "password updated successfully"}))
        response.set_cookie('user_password', new_password)
        return jsonify({"success": "Password updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/rooms/new', methods=['GET', 'POST'])
@require_api_key
def create_room():
    if (request.method == 'POST'): 
        name = "Unnamed Room " + ''.join(random.choices(string.digits, k=6))
        room = query_db('insert into rooms (name) values (?) returning id', [name], one=True)
        return jsonify({
            'room_id': room['id']
        })
    else:
        rooms = query_db('select * from rooms')
        return jsonify([dict(room) for room in rooms])

@app.route('/api/rooms/<int:room_id>/messages', methods=['GET'])
@require_api_key
def get_room_messages(room_id):
    messages = query_db("SELECT users.name, messages.body FROM messages INNER JOIN users ON messages.user_id = users.id WHERE messages.room_id = ?",
                         [room_id])
    print(messages)
    if messages:
        return jsonify([dict(message) for message in messages]), 200
    else:
        return jsonify([]), 200

@app.route('/api/rooms/<int:room_id>/messages', methods=['POST'])
@require_api_key
def post_message(room_id):
    body = request.json.get('body')
    user_id = request.cookies.get('user_id') 
    query_db('INSERT INTO messages (user_id, room_id, body) VALUES (?, ?, ?)', (user_id, room_id, body))
    return jsonify({"success": "Message posted"})

@app.route('/api/rooms/<int:roomid>', methods=['GET', 'POST'])
@require_api_key
def get_room_information(roomid):  
    print("get room information")
    if request.method == 'GET':
        room_info = query_db('SELECT * FROM rooms WHERE id = ?', [roomid], one=True)
        if room_info is None:
            return jsonify({'error': 'Room not found'}), 404
        return jsonify({
            'room_id': room_info['id'],
            'room_name': room_info['name']
        })
    
    elif request.method == 'POST':
        new_name = request.json.get('name')
        query_db('UPDATE rooms SET name = ? WHERE id = ?', [new_name, roomid])
        return jsonify({
            'room_name': new_name
        })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
    