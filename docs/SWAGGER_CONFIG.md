# Swagger Configuration (Sueder)

O PraiaFlow utiliza **swagger-jsdoc** e **swagger-ui-express** para gerar e exibir a documentação da API.

## ⚙️ Configuração no Servidor (`server.ts`)

A configuração do Swagger está integrada diretamente no `server.ts`:

```typescript
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PraiaFlow API',
      version: '1.0.0',
      description: 'Documentação da API do PraiaFlow - Sistema de Gestão de Quiosques',
      contact: {
        name: 'Suporte PraiaFlow',
        email: 'suporte@praiaflow.com.br'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor Local'
      }
    ]
  },
  apis: ['./server.ts'] // Caminho para os arquivos com anotações JSDoc
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// ... dentro do startServer() ...
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
```

## 📝 Como adicionar novos endpoints à documentação

Para documentar uma nova rota, utilize as anotações `@openapi` (ou `@swagger`) no comentário JSDoc acima da definição da rota no `server.ts`:

```typescript
/**
 * @openapi
 * /api/v1/minha-rota:
 *   get:
 *     summary: Descrição curta
 *     responses:
 *       200:
 *         description: Sucesso
 */
app.get("/api/v1/minha-rota", (req, res) => { ... });
```

## 🚀 Acesso
Acesse `http://localhost:3000/api-docs` para visualizar a documentação interativa.
