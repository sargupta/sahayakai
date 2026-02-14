
import swaggerJsdoc from 'swagger-jsdoc';

export const getApiDocs = async () => {
    const options = {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'SahayakAI API',
                version: '1.0',
                description: 'API Documentation for SahayakAI Platform. Authenticate using Bearer Token (Firebase ID Token) in the "Authorization" header.',
            },
            components: {
                securitySchemes: {
                    BearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'Enter your Firebase ID Token.',
                    },
                },
                schemas: {
                    // Schemas will be picked up from JSDoc in route files ideally, 
                }
            },
            security: [
                {
                    BearerAuth: [],
                },
            ],
        },
        apis: ['./src/app/api/**/*.ts'], // Path to the API docs
    };

    return swaggerJsdoc(options);
};
