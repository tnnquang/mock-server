import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { dynamicRouter, registerManagementRoutes } from './routes/dynamic-router';
import { MockRouteConfig } from './services/mock-generator';

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Internal management routes
// We will call this inside startServer or keep it here and pass empty initially
// Better to move the call inside startServer logic if we want to pass initialRoutes

// Dynamic router for mocked endpoints
app.use('/', dynamicRouter);

const PORT = process.env.PORT || 3000;

export const startServer = (port: number = 3000, initialRoutes: MockRouteConfig[] = []) => {
    registerManagementRoutes(app, initialRoutes);
    app.listen(port, () => {
        console.log(`Mock Server running on http://localhost:${port}`);
        console.log(`Management API: http://localhost:${port}/_mock-server`);
    });
};

if (require.main === module) {
    startServer(Number(PORT));
}
