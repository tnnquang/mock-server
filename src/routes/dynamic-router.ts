import { Router, Request, Response, NextFunction, Application } from 'express';
import { generateMockData, MockRouteConfig } from '../services/mock-generator';
import { validateMockConfig } from '../utils/validator';

export const dynamicRouter = Router();

const routes: MockRouteConfig[] = [];

export const seedRoutes = (initialRoutes: MockRouteConfig[]) => {
    initialRoutes.forEach(config => {
        const existingIndex = routes.findIndex(r => r.path === config.path && r.method === config.method);
        if (existingIndex >= 0) {
            routes[existingIndex] = config;
        } else {
            routes.push(config);
        }
    });
};

export const registerManagementRoutes = (app: Application, initialRoutes?: MockRouteConfig[]) => {
    const managementRouter = Router();

    if (initialRoutes && initialRoutes.length > 0) {
        seedRoutes(initialRoutes);
    }

    managementRouter.post('/register', (req: Request, res: Response) => {
        const config: MockRouteConfig = req.body;

        // Validate config
        const validation = validateMockConfig(config);
        if (!validation.valid) {
            res.status(400).json({
                error: 'Invalid configuration',
                details: validation.errors
            });
            return;
        }

        seedRoutes([config]);

        console.log(`Registered route: ${config.method} ${config.path}`);
        res.status(200).json({ message: 'Route registered successfully', route: config });
    });

    managementRouter.get('/routes', (req: Request, res: Response) => {
        res.json(routes);
    });

    app.use('/_mock-server', managementRouter);
};

// Middleware to find and execute matched route
dynamicRouter.use(async (req: Request, res: Response, next: NextFunction) => {
    const matchedRoute = routes.find(r => r.path === req.path && r.method === req.method);

    if (matchedRoute) {
        if (matchedRoute.delay) {
            await new Promise(resolve => setTimeout(resolve, matchedRoute.delay));
        }

        try {
            const { page, limit } = req.query;
            const result = await generateMockData(matchedRoute, {
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined
            });
            res.json(result);
        } catch (error: any) {
            console.error('Error generating mock:', error);
            res.status(500).json({ error: 'Failed to generate mock data', details: error.message });
        }
    } else {
        next();
    }
});
