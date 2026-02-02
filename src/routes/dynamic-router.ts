import { Router, Request, Response, NextFunction, Application } from 'express';
import { generateMockData, MockRouteConfig } from '../services/mock-generator';
import { validateMockConfig } from '../utils/validator';
import { saveRoutes, loadRoutes } from '../utils/storage';
import * as fs from 'fs';
import * as path from 'path';

export const dynamicRouter = Router();

// Load persisted routes on startup
const routes: MockRouteConfig[] = loadRoutes();
let globalTsconfigPath: string | undefined;

export const setGlobalTsconfigPath = (path: string) => {
    globalTsconfigPath = path;
};

export const seedRoutes = (initialRoutes: MockRouteConfig[], shouldSave: boolean = false) => {
    initialRoutes.forEach(config => {
        const existingIndex = routes.findIndex(r => r.path === config.path && r.method === config.method);
        if (existingIndex >= 0) {
            routes[existingIndex] = config;
        } else {
            routes.push(config);
        }
    });

    if (shouldSave) {
        saveRoutes(routes);
    }
};

export const registerManagementRoutes = (app: Application, initialRoutes?: MockRouteConfig[]) => {
    const managementRouter = Router();

    managementRouter.post('/register', (req: Request, res: Response) => {
        let config: MockRouteConfig = req.body;

        // Handle configFile if present
        if (config.configFile) {
            try {
                const configFilePath = path.isAbsolute(config.configFile)
                    ? config.configFile
                    : path.resolve(process.cwd(), config.configFile);

                if (fs.existsSync(configFilePath)) {
                    const fileContent = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                    // Merge: file content defines the core, body defines the route (path/method)
                    config = { ...fileContent, ...config };
                } else {
                    res.status(400).json({ error: `Config file not found: ${config.configFile}` });
                    return;
                }
            } catch (e: any) {
                res.status(400).json({ error: `Error reading config file: ${e.message}` });
                return;
            }
        }

        // Validate config
        const validation = validateMockConfig(config);
        if (!validation.valid) {
            res.status(400).json({
                error: 'Invalid configuration',
                details: validation.errors
            });
            return;
        }

        seedRoutes([config], true); // Save on new registration

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
                limit: limit ? Number(limit) : undefined,
                tsconfigPath: globalTsconfigPath
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
