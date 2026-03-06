# Projeto Fin - Gestão Financeira PWA

Este projeto é um Progressive Web App (PWA) moderno para controle financeiro doméstico, focado em simplicidade, rapidez e equilíbrio visual.

## 🚀 Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (Módulos ES6).
- **Design:** Mobile-First, Tema Escuro (Premium Dark Mode), Fonte Inter, Bootstrap Icons.
- **Backend/Database:** Firebase Firestore (Banco de dados NoSQL).
- **Autenticação:** Firebase Auth (Google Login e E-mail/Senha).
- **Gráficos:** Chart.js (Dashboard dinâmico).
- **PWA:** Service Workers e Web App Manifest para instalação mobile.
- **Testes:** Vitest (Testes unitários de utilitários e serviços).

## 📂 Estrutura de Pastas

- `index.html`: Ponto de entrada SPA (Single Page Application).
- `css/style.css`: Estilização completa do sistema (variáveis CSS, layouts flex/grid, responsividade).
- `js/app.js`: Lógica principal da interface, navegação e integração com Firebase.
- `js/settings-service.js`: Serviço de gestão de categorias, pagamentos e dívidas fixas.
- `js/auth-service.js`: Serviço de autenticação Firebase.
- `js/import-service.js`: Lógica de processamento de dados em lote.
- `js/firebase-config.js`: Configurações de credenciais do Firebase.
- `js/utils.js`: Funções utilitárias (formatação, cálculos de parcelas).
- `js/importador.js`: Script auxiliar para importação de dados históricos.
- `sw.js`: Service Worker para funcionamento offline e cache de assets.
- `manifest.json`: Manifesto do PWA para instalação no celular.
- `assets/`: Ícones, favicons e imagens de referência.
- `docs/`: Logs, capturas de tela e histórico de dados.
- `tests/`: Testes unitários para garantir a integridade dos cálculos, parcelas e serviços.

## ✨ Funcionalidades Implementadas

1.  **Autenticação Segura:**
    - Login rápido com Google.
    - Cadastro e Login com E-mail e Senha.
    - Interface de autenticação moderna e centralizada.
    - Proteção de rotas e logout integrado.

2.  **Dashboard (Painel de Controle):**
    - **Filtros Inteligentes:** Seleção por Mês, Ano e Categoria.
    - **Gráficos Dinâmicos:** Visualização do uso do limite por categoria (Chart.js).
    - **Histórico Completo:** Lista de despesas com badges informativos.
    - **Edição/Exclusão:** Modal para ajustes de despesas existentes.

3.  **Lógica Avançada de Parcelamento:**
    - **Propagação Automática:** Despesas parceladas aparecem em todos os meses correspondentes.
    - **Indicador de Parcela:** Badge visual (ex: 1/3, 2/3) no histórico baseado no mês filtrado.
    - **Cálculos Precisos:** Utilização de funções utilitárias testadas para gerenciar períodos e viradas de ano.

4.  **Fluxo de Cadastro:**
    - Cadastro rápido de despesas (À Vista / Parcelado).
    - Barra de progresso em tempo real ao selecionar categoria.
    - Validação rigorosa de campos obrigatórios.

5.  **Gestão de Ajustes (Configurações):**
    - Gerenciamento de Categorias (com limites mensais).
    - Formas de Pagamento (Débito, Crédito com fechamento/vencimento, Boletos).
    - Dívidas Fixas recorrentes.

6.  **PWA e Responsividade:**
    - Mobile-First com suporte a rolagem em modais e campos padronizados.
    - Funcionamento offline via Service Workers.
    - Instalável em dispositivos Android e iOS.

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
*Documentação atualizada pelo Gemini CLI.*
