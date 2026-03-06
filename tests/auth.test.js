import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../js/auth-service.js';

describe('AuthService - Testes de Login e Conexão', () => {
    
    // Simulação (Mock) do objeto Auth do Firebase
    const mockAuth = {
        signInWithEmailAndPassword: vi.fn((email, pass) => {
            if (email === 'erro@teste.com') return Promise.reject(new Error('Falha no login'));
            return Promise.resolve({ user: { email } });
        }),
        createUserWithEmailAndPassword: vi.fn((email, pass) => {
            return Promise.resolve({ user: { email } });
        }),
        signOut: vi.fn(() => Promise.resolve())
    };

    const authService = new AuthService(mockAuth);

    it('deve chamar signInWithEmailAndPassword com os dados corretos', async () => {
        const email = 'test@fin.com';
        const pass = '123456';
        
        await authService.loginWithEmail(email, pass);
        
        expect(mockAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(email, pass);
    });

    it('deve rejeitar se o login falhar', async () => {
        await expect(authService.loginWithEmail('erro@teste.com', '123'))
            .rejects.toThrow('Falha no login');
    });

    it('deve validar se e-mail ou senha estão vazios no cadastro', async () => {
        await expect(authService.signUpWithEmail('', ''))
            .rejects.toThrow('Email e senha são obrigatórios');
    });

    it('deve validar tamanho mínimo da senha no cadastro', async () => {
        await expect(authService.signUpWithEmail('test@fin.com', '123'))
            .rejects.toThrow('A senha deve ter pelo menos 6 caracteres');
    });

    it('deve chamar signOut ao fazer logout', async () => {
        await authService.logout();
        expect(mockAuth.signOut).toHaveBeenCalled();
    });
});