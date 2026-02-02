import * as fs from 'fs';
import * as path from 'path';
import { MockRouteConfig } from '../services/mock-generator';

const STORAGE_FILE = path.resolve(process.cwd(), 'routes-db.json');

export function saveRoutes(routes: MockRouteConfig[]): void {
    try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(routes, null, 2), 'utf-8');
        console.log(`Routes saved to ${STORAGE_FILE}`);
    } catch (error) {
        console.error('Error saving routes:', error);
    }
}

export function loadRoutes(): MockRouteConfig[] {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
            const routes = JSON.parse(content);
            console.log(`Loaded ${routes.length} routes from ${STORAGE_FILE}`);
            return routes;
        }
    } catch (error) {
        console.error('Error loading routes:', error);
    }
    return [];
}
