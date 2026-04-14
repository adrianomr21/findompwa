# Guia de Integração: MacroDroid -> Fin App

Este documento descreve como enviar compras capturadas por SMS (ou outras notificações) diretamente para a fila de **Aprovações** do seu sistema de finanças usando a API REST do Firebase.

---

## 1. Credenciais do Projeto

Use estes dados para configurar as requisições (extraídos do seu `firebase-config.js`):

- **Project ID:** `financaspwa`
- **API Key:** `AIzaSyAyh7qIiGMbjqhD8YykAUzBMn0Y1vHmTrA`
- **Seu User ID (UID):** `cvlyquTYJGUfxnEeFveAldJa00E3`

---

## 2. Configuração da Requisição (Postman ou MacroDroid)

### Detalhes do Endpoint
- **Método:** `POST`
- **URL:** `https://firestore.googleapis.com/v1/projects/financaspwa/databases/(default)/documents/compras_pendentes?key=AIzaSyAyh7qIiGMbjqhD8YykAUzBMn0Y1vHmTrA`

### Cabeçalhos (Headers)
- `Content-Type`: `application/json`

### Corpo da Requisição (Body - JSON)
O Firestore exige que cada campo seja tipado. Use o modelo abaixo:

```json
{
  "fields": {
    "userId": { "stringValue": "COLE_SEU_UID_AQUI" },
    "value": { "doubleValue": 125.50 },
    "description": { "stringValue": "NOME DO ESTABELECIMENTO" },
    "smsText": { "stringValue": "Texto original do SMS recebido para referência" },
    "date": { "stringValue": "2026-04-14T10:00:00Z" }
  }
}
```

---

## 3. Passo a Passo no MacroDroid

Para automatizar, configure uma macro com:

1.  **Gatilho:** SMS Recebido (ou Notificação Recebida).
2.  **Ações de Variáveis:**
    - Use "Extrair Texto" com RegEx para pegar o valor (ex: `R\$ (\d+,\d+)`).
    - Converta a vírgula para ponto (ex: `10,50` -> `10.50`).
3.  **Ação:** Requisição HTTP (POST).
    - Cole a URL e os Headers acima.
    - No Body, substitua os valores fixos pelas variáveis do MacroDroid (ex: `{lv=valor_extraido}`).

---

## 4. Fluxo no Aplicativo Fin

1.  **Notificação:** Um badge (círculo vermelho) aparecerá no ícone **"Aprovar"** na barra inferior assim que o dado chegar ao Firebase.
2.  **Visualização:** Na tela "Aprovar", você verá o card com os dados da compra e o texto do SMS original.
3.  **Ação "Descartar":** Remove a compra da fila sem registrar.
4.  **Ação "Aprovar":**
    - Abre a tela **"Novo Gasto"** com o valor e nome já preenchidos.
    - Você seleciona a **Categoria** e a **Forma de Pagamento**.
    - Ao clicar em **"Registrar Gasto"**, o item é salvo oficialmente e a pendência é removida automaticamente da fila.

---
*Documento gerado pelo Gemini CLI para o Projeto Fin.*
