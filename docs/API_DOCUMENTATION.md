# PraiaFlow API Documentation (Swagger/OpenAPI)

Esta documentação detalha os endpoints da API do sistema PraiaFlow.

## 🚀 Acesso Rápido
A documentação interativa (Swagger UI) está disponível em:
`http://localhost:3000/api-docs`

---

## 🛠️ Endpoints Principais

### 1. Saúde do Sistema
*   **GET `/api/health`**
    *   **Descrição**: Verifica se o servidor está respondendo.
    *   **Resposta**: `{ "status": "ok", "timestamp": "..." }`

### 2. Sincronização de Testes
*   **GET `/api/v1/tests/sync`**
    *   **Descrição**: Sincroniza as regras de negócio entre o Firestore e os arquivos locais (`src/tests/business/`).
    *   **Uso**: Chamado automaticamente pelo painel Root ao clicar em "Sincronizar".

### 3. Pagamentos (Mercado Pago)
*   **POST `/api/v1/payments/create`**
    *   **Descrição**: Cria uma intenção de pagamento via PIX.
    *   **Corpo**:
        ```json
        {
          "orderId": "ID_DO_PEDIDO",
          "amount": 100.50,
          "email": "cliente@email.com",
          "description": "Pedido #123"
        }
        ```
*   **POST `/api/v1/payments/webhook`**
    *   **Descrição**: Endpoint de notificação do Mercado Pago para atualização de status.

---

## 🧪 API Tester (Painel Root)
O painel administrativo (`/root`) contém uma ferramenta integrada para testar estas requisições sem a necessidade de ferramentas externas como Postman ou Insomnia.

### Como usar:
1. Navegue até a aba **"API Tester"**.
2. Selecione o método (GET, POST, etc.).
3. Digite a URL (ex: `/api/health`).
4. Se necessário, preencha o **Request Body** em formato JSON.
5. Clique em **"Enviar"**.
6. O resultado será exibido no painel lateral com o status HTTP e o tempo de resposta.

---

## 🔒 Autenticação
Atualmente, as rotas de API públicas não exigem token JWT para simplificar o desenvolvimento, mas as operações de escrita no Firestore são protegidas pelas **Security Rules** do Firebase, exigindo autenticação via Firebase Auth.
