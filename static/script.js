// Constants to easily refer to pages
const SPLASH = document.querySelector(".splash");
const PROFILE = document.querySelector(".profile");
const LOGIN = document.querySelector(".login");
const ROOM = document.querySelector(".room");

// Custom validation on the password reset fields
const passwordField = document.querySelector(".profile input[name=password]");
const repeatPasswordField = document.querySelector(".profile input[name=repeatPassword]");
const repeatPasswordMatches = () => {
  const p = document.querySelector(".profile input[name=password]").value;
  const r = repeatPassword.value;
  return p == r;
};

const checkPasswordRepeat = () => {
  const passwordField = document.querySelector(".profile input[name=password]");
  if(passwordField.value == repeatPasswordField.value) {
    repeatPasswordField.setCustomValidity("");
    return;
  } else {
    repeatPasswordField.setCustomValidity("Password doesn't match");
  }
}

passwordField.addEventListener("input", checkPasswordRepeat);
repeatPasswordField.addEventListener("input", checkPasswordRepeat);

//-----------------------------------------------------------------------------------
let ifLoggedIn = false;

let show = (element) => {
  SPLASH.classList.add("hide")
  PROFILE.classList.add("hide");
  LOGIN.classList.add("hide");
  ROOM.classList.add("hide");

  element.classList.remove("hide");
}

window.addEventListener('popstate', function(event) {
  router();
});

let router = () => {
  let path = window.location.pathname;
  if(ifLoggedIn) {
  if(path == "/") {
    show(SPLASH);
    getRooms();
    stopMessagePolling();
    console.log("1");
    localStorage.setItem('lastPath', path);
  }

  else if(path == "/profile"){
      show(PROFILE);
      localStorage.setItem('lastPath', path);
  } 
  else if(path.startsWith("/rooms/")) {
      show(ROOM);
      roomId = path.split('/')[2];
      localStorage.setItem('lastPath', path);
      var room_space = document.getElementById('room_id');
      room_space.textContent = '/rooms/' + roomId;
      
      getRoomName(roomId).then(roomName => {
        var roomNameElement = document.querySelector('.room-name');
        roomNameElement.textContent = roomName;
      });
      getMessages(roomId);
      startMessagePolling(roomId);
  }
  else if(path == "/signup") {
      show(PROFILE);
    }
    else {
      console.log("I don't know how we got to "+path+", but something has gone wrong");
    }

  }
  else{
    history.pushState({}, '', '/login');
    show(LOGIN);
  }
}

function updateUserInfo(url, data) {
  var api_key = localStorage.getItem('api_key');
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': api_key
    },
    body: JSON.stringify(data)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    item = url.match(/[^\/]+$/)[0];
    alert(`${item} updated successfully!`);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
}

function updateUiName(value) {
  localStorage.setItem('username', value);
  const elements = document.querySelectorAll('[name="dynamic_name"]');
  elements.forEach(function(element) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value = value;
    } else {
      element.textContent = value;
    }
  });
}

function getRoomName(roomId) {
  var api_key = localStorage.getItem('api_key');
  return fetch(`/api/rooms/${roomId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': api_key
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    return data.room_name;
  });
}

function signup() {
  fetch('/api/signup', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
  })
  .then(response => response.json())
  .then(data => {
      if(data['api_key']) {
        localStorage.setItem('api_key', data['api_key']); // Store API key in localStorage
        localStorage.setItem('username', data['name']);
        localStorage.setItem('password', data['password']);
          // Redirect the user or update the UI as necessary
          ifLoggedIn = true;
          updateUiName(data['name']);
          history.pushState({}, '', '/profile');
          router();
          console.log('Signup successful, API key stored');
      } else {
          console.error('Signup failed');
          // Handle signup failure (e.g., display an error message)
      }
  })
  .catch(error => {
      console.error('Error during signup:', error);
  });
}

function login(username, password) {
  fetch('/api/login', {
    method: 'GET', 
    headers: {
      'Content-Type': 'application/json', 
      'Username': username, 
      'Password': password
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json(); // Process the response if it's OK
    } else {
      alert(`Login failed`);
      return null; // Prevent further processing in the promise chain
    }
  })
  .then(data => {
    if (data) { 
      localStorage.setItem('api_key', data.api_key);
      localStorage.setItem('username', username);
      localStorage.setItem('password', password);
      updateUiName(username);
      ifLoggedIn = true; 
      history.pushState({}, '', '/');
      router(); // Make sure router is a function accessible in this scope
    }
  })
  .catch(error => {
    console.error('Error during login:', error);
  });
}

function logout() {
  fetch('/api/logout', {
      method: 'POST',
  })
  .then(response => {
      ifLoggedIn = false;
      localStorage.removeItem('api_key');  
      window.location.reload();
  })
  .catch(error => console.error('Error:', error));
}


//-----------------room--------------------------------------------------
CURRENT_ROOM = 0

function handleRoomClick(roomId) {
  history.pushState({ roomId }, '', `/rooms/${roomId}`);
  CURRENT_ROOM = roomId;
  router();
}

function updateRoomsUI(rooms) {
  const roomsContainer = document.querySelector('.roomList');
  const noRoomsMessage = document.querySelector('.noRooms');

  roomsContainer.innerHTML = '';

  noRoomsMessage.style.display = rooms.length > 0 ? 'none' : 'block';

  const roomLinksHTML = rooms.map(room => {
    return `<a class='room-link' onclick='handleRoomClick(${room.id})'>${room.id}: ${room.name}</a>`;
  }).join('');
  roomsContainer.innerHTML = roomLinksHTML;
}
 

function createRoom() {
  var api_key = localStorage.getItem('api_key');
  fetch('/api/rooms/new', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': api_key
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // console.log('Created Room with ID:', data.room_id);
    getRooms();
  })
  .catch(error => {
    console.error('Error creating room:', error);
  });
}

function getRooms() {
  var api_key = localStorage.getItem('api_key');
  console.log(api_key)
  fetch('/api/rooms/new', { 
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': api_key
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(rooms => {
    // console.log("tried to get rooms");
    updateRoomsUI(rooms);
    // router();
  })
  .catch(error => {
    console.error('Error getting rooms:', error);
  });
}

function getMessages(roomId) {
  var api_key = localStorage.getItem('api_key');
  console.log(document.cookie);
  fetch(`/api/rooms/${roomId}/messages`,  {headers: {
    'Api-Key': api_key
  }})
    .then(response => response.json())
    .then(messages => {

        const messagesContainer = document.querySelector('.messages');
        messagesContainer.innerHTML = ''; // Clear existing messages
        messages.forEach(message => {
          const messageElement = document.createElement('message');
          const authorElement = document.createElement('author');
          authorElement.textContent = message.name; 
          const contentElement = document.createElement('content');
          contentElement.textContent = message.body;
          messageElement.appendChild(authorElement);
          messageElement.appendChild(contentElement);
          messagesContainer.appendChild(messageElement);
      });
    })
    .catch(error => console.error('Error fetching messages:', error));
}

function postMessage(roomId, comment) {
  var api_key = localStorage.getItem('api_key');
  fetch(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': api_key
    },
    body: JSON.stringify({ body: comment })
  })
  .then(response => response.json())
  .then(() => {
    const commentInput = document.querySelector('.comment_box textarea[name="comment"]');
    commentInput.value = '';
  })
}

function handleEditRoomNameClick() {
  const new_name = document.querySelector('.editRoomName input').value;
  updateRoomName(new_name);
  document.querySelector('.editRoomName input').value = '';
}

function updateRoomName(new_name) {
  var api_key = localStorage.getItem('api_key');

  fetch(`/api/rooms/${CURRENT_ROOM}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
       'API-Key': api_key
    },
    body: JSON.stringify({ name: new_name })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok.');
    }
    return response.json(); 
  })
  .then(roomDetails => {
    const roomNameElement = document.querySelector('.displayRoomName strong');
    roomNameElement.textContent = roomDetails.room_name;
    getRooms();
  })
  .catch(error => {
    console.error('Error updating room name:', error);
  });
}

let messagePollingInterval;

function startMessagePolling() {
  let path = window.location.pathname;

  if (messagePollingInterval) clearInterval(messagePollingInterval);

  let pathSegments = path.split("/");
  if (pathSegments[1] !== "rooms" || pathSegments.length !== 3 || !pathSegments[2]) {
    return; 
  }

  let CURRENT_ROOM = pathSegments[2];

  messagePollingInterval = setInterval(() => {
    getMessages(CURRENT_ROOM);
  }, 500);
}

function stopMessagePolling() {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
    messagePollingInterval = null;
  }
}

//----------------------------------------------------------------------------
// DOMContentLoaded to ensure DOM is fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', async function() {
  if (localStorage.getItem('api_key')) {
    console.log("loadloadload")
    ifLoggedIn = true;
    updateUiName(localStorage.getItem('username'));
  } else {
    ifLoggedIn = false;
  }
  router();
  attachEventListeners();
});

function attachEventListeners() {
  // Navigation Buttons
  const goToSplashButton = document.querySelector('.exit.goToSplash');
  goToSplashButton.addEventListener('click', () => navigateTo('/'));

  const createNewAccountButton = document.getElementById('createNewAccount');
  createNewAccountButton.addEventListener('click', signupAndSetUsername);

  const signupButton = document.querySelector('.signup');
  signupButton.addEventListener('click', signupAndSetUsername);

  const nameTag = document.querySelector('.welcomeBack');
  nameTag.addEventListener('click', signupAndSetUsername);

  const loginButton = document.getElementById('login_btn');
  loginButton.addEventListener('click', logoutAndNavigate);

  const logoutButton = document.querySelector('.exit.logout');
  logoutButton.addEventListener('click', logoutAndNavigate);
  // Update User Info
  const updateUsernameButton = document.getElementById('update-username-btn');
  updateUsernameButton.addEventListener('click', updateUsername);

  const updatePasswordButton = document.getElementById('update-password-btn');
  updatePasswordButton.addEventListener('click', updatePassword);

  // Room Actions
  const createRoomButton = document.querySelector('.create');
  createRoomButton.addEventListener('click', createRoom);

  const postButton = document.getElementById('post_submit');
  postButton.addEventListener('click', postComment);

  const editRoomNameButton = document.getElementById('updateRoomName');
  editRoomNameButton.addEventListener('click', handleEditRoomNameClick);
  // Handle popstate event for SPA navigation
  window.addEventListener('popstate', (event) => {
    console.log("Popstate event triggered", event.state);
    router();
  });
}

function navigateTo(path) {
  history.pushState({}, '', path);
  router();
}

function signupAndSetUsername() {
  signup();
  updateUiName(localStorage.getItem('name'));
}

function loginAndNavigate() {
  navigateTo('/login');
}

const loginLoginButton = document.getElementById('login_btn_lg');
loginLoginButton.addEventListener('click', loginApp);

function loginApp() {
  const login_username = document.getElementById('loginUsernameInput').value;
  const login_password = document.getElementById('loginPasswordInput').value;
  login(login_username, login_password);
}



function logoutAndNavigate() {
  logout();
  navigateTo('/profile');
}

function updateUsername() {
  const newUsername = document.getElementById('username-input').value;
  updateUserInfo('/api/user/name', {new_username: newUsername});
  updateUiName(newUsername);
}

function updatePassword() {
  const newPassword = document.getElementById('password-input').value;
  updateUserInfo('/api/user/password', {new_password: newPassword});
}

function postComment() {
  const commentInput = document.querySelector('.comment_box textarea[name="comment"]');
  const commentText = commentInput.value;

  if (commentText.trim() === '') {
    alert('Please enter a comment before posting.');
    return;
  }
  const roomId = window.location.pathname.split('/')[2];
  console.log('Comment:', commentText);
  console.log(roomId); 
  postMessage(roomId, commentText); // Assuming postMessage is a function to post a message
  getMessages(roomId); // Assuming getMessages is a function to fetch messages
  router(); 
}



