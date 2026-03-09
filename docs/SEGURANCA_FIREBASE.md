# Guia de Segurança - Credenciais do Firebase

Neste projeto, as chaves do Firebase são usadas pelo SDK no navegador para identificar seu projeto. Como se trata de uma Single Page Application (SPA), elas são visíveis no código-fonte. Contudo, **identificadores não são segredos**. A segurança real do Firebase não depende da ocultação das chaves, mas sim das **Regras de Segurança** e **Restrições no Console**.

Abaixo estão as melhores práticas para proteger seu ambiente.

---

## 1. Restrição de Chave de API (Fundamental)

Sua `apiKey` permite que qualquer pessoa faça requisições ao seu projeto. Você deve restringir seu uso apenas aos seus domínios autorizados.

1.  Acesse o [Console do Google Cloud](https://console.cloud.google.com/).
2.  Vá em **APIs e Serviços > Credenciais**.
3.  Edite a chave de API usada pelo Firebase (geralmente chamada de "Browser key" ou similar).
4.  Em **Restrições de Aplicativo**, selecione **Referenciadores de HTTP (sites)**.
5.  Adicione seus domínios:
    - `http://localhost:8080/*` (Desenvolvimento)
    - `http://127.0.0.1:8080/*`
    - `https://seu-dominio-producao.web.app/*`
6.  Em **Restrições de API**, você também pode limitar a chave para usar apenas os serviços necessários (Firestore, Auth, Cloud Storage).

---

## 2. Regras de Segurança do Firestore (Obrigatório)

Sem regras de segurança, qualquer pessoa com sua `apiKey` pode ler ou deletar todo o seu banco de dados.

**Nunca use regras de "teste" (`allow read, write: if true`) em produção.**

Exemplo de regra segura para este projeto:
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    // Garante que o usuário só pode ler/escrever seus próprios dados
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regra específica para a coleção de despesas baseada no campo userId
    match /despesas/{despesaId} {
      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## 3. Firebase App Check (Proteção Avançada)

O **App Check** ajuda a garantir que apenas o seu aplicativo legítimo possa acessar seus serviços de back-end. Ele impede o uso das suas chaves por scripts automatizados ou outros sites.

- Ele verifica se a requisição vem de um dispositivo real e do seu app oficial (usando reCAPTCHA Enterprise no Web ou Play Integrity no Android).

---

## 4. Uso de Variáveis de Ambiente (Opcional - Requer Bundler)

Se você decidir migrar para um bundler como **Vite** ou **Webpack**, poderá usar um arquivo `.env` para gerenciar as chaves e evitar que elas sejam enviadas para o GitHub.

1.  Crie um arquivo `.env` (ex: `VITE_FIREBASE_API_KEY=suachave`).
2.  Adicione `.env` ao seu `.gitignore`.
3.  No código: `apiKey: import.meta.env.VITE_FIREBASE_API_KEY`.

**Nota:** Mesmo com variáveis de ambiente, as chaves ainda serão visíveis no "Bundle" final do navegador após o build. Elas apenas ficam fora do histórico do Git.

---

## Resumo do Plano de Ação

1.  [ ] Restringir a chave de API no Google Cloud Console por domínio.
2.  [ ] Revisar e publicar as regras de segurança no Firestore Console.
3.  [ ] Adicionar o arquivo `js/firebase-config.js` ao `.gitignore` se ele contiver dados de produção sensíveis e você estiver trabalhando em um repositório público (usando um arquivo de exemplo como `js/firebase-config.example.js` para outros desenvolvedores).

---
*Documentação gerada pelo Gemini CLI.*
