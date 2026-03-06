// Serviço de Autenticação para isolar a lógica do Firebase
export class AuthService {
    constructor(auth) {
        this.auth = auth;
    }

    loginWithEmail(email, password) {
        if (!email || !password) return Promise.reject(new Error("Email e senha são obrigatórios"));
        return this.auth.signInWithEmailAndPassword(email, password);
    }

    signUpWithEmail(email, password) {
        if (!email || !password) return Promise.reject(new Error("Email e senha são obrigatórios"));
        if (password.length < 6) return Promise.reject(new Error("A senha deve ter pelo menos 6 caracteres"));
        return this.auth.createUserWithEmailAndPassword(email, password);
    }

    logout() {
        return this.auth.signOut();
    }
}