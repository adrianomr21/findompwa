// Adicione suas credenciais do Firebase aqui
const firebaseConfig = {
  apiKey: "AIzaSyAyh7qIiGMbjqhD8YykAUzBMn0Y1vHmTrA",
  authDomain: "financaspwa.firebaseapp.com",
  projectId: "financaspwa",
  storageBucket: "financaspwa.firebasestorage.app",
  messagingSenderId: "185410605818",
  appId: "1:185410605818:web:34fd4a99848c27079c2f43"
};

// Inicializar Firebase (compat mode para index.html)
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
}

export default firebaseConfig;