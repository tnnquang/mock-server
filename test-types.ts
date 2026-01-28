export interface User {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
    roles: string[];
    profile: {
        age: number;
        bio: string;
    };
}

export type Product = {
    sku: string;
    price: number;
    tags: string[];
}
