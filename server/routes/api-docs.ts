import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument } from '../config/openapi';

export function createApiDocsRouter() {
  const router = Router();

  // Cache for the OpenAPI document (generated once on first request)
  let openApiDocumentCache: any = null;

  // Helper to get or generate the OpenAPI document
  async function getOpenApiDocument() {
    if (!openApiDocumentCache) {
      openApiDocumentCache = await generateOpenAPIDocument();
    }
    return openApiDocumentCache;
  }

  // Serve the OpenAPI JSON spec at /api/docs/openapi.json
  router.get('/openapi.json', async (req, res) => {
    const openApiDocument = await getOpenApiDocument();
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiDocument);
  });

  // Serve the Swagger UI at /api/docs
  // We need to handle this differently since generateOpenAPIDocument is now async
  router.use('/', swaggerUi.serve);
  router.get('/', async (req, res, next) => {
    try {
      const openApiDocument = await getOpenApiDocument();
      const swaggerHtml = swaggerUi.generateHTML(openApiDocument, {
        customSiteTitle: 'Sandwich Project Platform API',
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info .title { color: #3b4151; }
        `,
        customCssUrl: undefined,
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
        },
      });
      res.send(swaggerHtml);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
