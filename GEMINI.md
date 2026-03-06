# Projeto Fin - Gestão Financeira PWA

Este projeto é um Progressive Web App (PWA) moderno para controle financeiro doméstico, focado em simplicidade, rapidez e equilíbrio visual.

## 🚀 Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (Módulos ES6).
- **Design:** Mobile-First, Tema Escuro (Premium Dark Mode), Fonte Inter, Bootstrap Icons.
- **Backend/Database:** Firebase Firestore (Banco de dados NoSQL).
- **Autenticação:** Firebase Auth (Google Login e E-mail/Senha).
- **Gráficos:** Chart.js (Dashboard).
- **PWA:** Service Workers e Web App Manifest para instalação mobile.
- **Testes:** Vitest (Testes unitários de utilitários).

## 📂 Estrutura de Pastas

- `index.html`: Ponto de entrada SPA (Single Page Application).
- `css/style.css`: Estilização completa do sistema (variáveis CSS, layouts flex/grid, responsividade).
- `js/app.js`: Lógica principal da interface, navegação e integração com Firebase.
- `js/firebase-config.js`: Configurações de credenciais do Firebase.
- `js/utils.js`: Funções utilitárias (formatação, cálculos).
- `js/importador.js`: Script auxiliar para importação de dados históricos.
- `sw.js`: Service Worker para funcionamento offline e cache de assets.
- `manifest.json`: Manifesto do PWA para instalação no celular.
- `assets/`: Ícones, favicons e imagens de referência.
- `docs/`: Logs, capturas de tela e histórico de dados.
- `tests/`: Testes unitários para garantir a integridade dos cálculos.

## ✨ Funcionalidades Implementadas

1.  **Autenticação Segura:**
    - Login rápido com Google.
    - Cadastro e Login com E-mail e Senha.
    - Visualização de senha (ícone de olho).
    - Proteção de rotas (o app só aparece após o login).
    - Botão de Logout integrado ao menu.

2.  **Fluxo de Cadastro (Entrada Inicial):**
    - Cadastro rápido de despesas logo ao entrar.
    - Campo de valor grande e centralizado para rapidez.
    - Seletor de Modo (À Vista / Parcelado) perfeitamente alinhado.
    - **Barra de Progresso Dinâmica:** Informa o limite e o gasto da categoria selecionada em tempo real (Verde/Amarelo/Vermelho).

3.  **Visualização Proeminente:**
    - **Banner de Total Global:** Exibe o gasto total do mês de forma clara no topo da tela.
    - **Bottom Nav (Mobile):** Barra de navegação inferior estilo app nativo.
    - **Sidebar (Desktop):** Barra lateral fixa para telas grandes.

4.  **Importação em Lote:**
    - Botão dedicado para importar centenas de registros de uma vez via cópia de texto (formato .md/TSV).
    - Feedback de progresso linha a linha.

## 🛠️ Configuração e Rodagem

1.  **Dependências de Desenvolvimento:**
    ```bash
    npm install
    ```
2.  **Rodar Testes:**
    ```bash
    npm test
    ```
3.  **Servidor Local:**
    Recomenda-se o uso do `Live Server` (VS Code) ou `npm run dev`. O domínio `127.0.0.1` deve ser autorizado no Firebase Console.

4.  **Firebase:**
    - Ativar Firestore Database (southamerica-east1).
    - Ativar Authentication (Google e E-mail/Senha).
    - Configurar as chaves no arquivo `js/firebase-config.js`.

---
*Documentação gerada pelo Gemini CLI.*