# 🚀 Advanced Mock Server

A high-performance, flexible Mock Server designed to bridge the gap between Frontend and Backend development. This tool allows you to spin up virtual REST APIs in seconds using your existing **TypeScript interfaces**, **JSON Schema**, or **Sample Data**.

## 🎯 Purpose & Why Use This?

In modern web development, Frontend teams often have to wait for Backend APIs to be ready. This project solves that by:

- **Instant Prototyping**: Convert your TS interfaces directly into working API endpoints.
- **Realistic Testing**: Generate massive amounts of localized data (Vietnamese) to test UI layouts and pagination.
- **Contract-First Development**: Use JSON Schema to define precise data contracts before a single line of backend code is written.
- **Persistence**: Unlike standard memory-only mock servers, your registered routes are saved and ready after restarts.

---

---

### 📂 Advanced Configuration Features

#### 1. `configFile` Support

Instead of sending a massive JSON body, you can point to a local JSON file:

```json
{
  "path": "/api/users",
  "method": "GET",
  "configFile": "configs/user-list.json"
}
```

#### 2. Virtual Types (`types` key)

Define data structures directly in your config without needing an actual `.ts` file:

```json
"mainConfig": {
  "types": {
    "User": {
      "return": "array",
      "itemType": {
        "id": "number",
        "name": "faker:person.fullName",
        "email": "string"
      }
    }
  }
}
```

---

### 🚀 Management API

- 🇻🇳 **Vietnamese Localized Data**: Built-in Faker.js integration (locale: `vi`) for realistic names, addresses, and phone numbers.
- **TypeScript Engine**: Resolves complex types, utility types (`Omit`, `Partial`), and external interfaces.
- 📂 **Persistence Layer**: Auto-saves all registered routes to `routes-db.json`.
- 🔢 **Smart Pagination**: Automatic handling of `page` and `limit` query parameters.
- 🎨 **Dynamic Templates**: Inject generated data into any JSON structure using `{{data}}`, `{{page}}`, etc.
- 📱 **JSON Schema support**: Direct mocking from standard JSON Schema patterns.
- 💻 **Hybrid Interface**: Use the **CLI** for quick one-off data generation or the **REST API** for dynamic route management.

---

## 🛠 Installation & Setup

```bash
# Clone and install
git clone https://github.com/tnnquang/mock-server.git
cd mock-server
npm install

# Build the project
npm run build
```

---

## 💻 CLI Usage Guide

### 1. `serve` (Start API Server)

Launch the server to handle HTTP requests.

```bash
# Basic start (Port 3000)
node dist/cli.js serve

# Start with custom port and pre-defined config
node dist/cli.js serve --port 4000 --config initial-config.json --tsconfig tsconfig.json
```

**Options:**

- `-p, --port <number>`: Port (Default: 3000).
- `-c, --config <path>`: Initial routes JSON file.
- `--tsconfig <path>`: Path to project's `tsconfig.json` (Required for complex TS types).

### 2. `mock` (Quick Data Tool)

Generate mock data directly to console or file (No server required).

```bash
# Generate from TS interface (List mode)
node dist/cli.js mock --file src/types.ts --type User --count 10 --list --tsconfig tsconfig.json

# Generate Vietnamese Data via JSON Schema
node dist/cli.js mock --schema "{\"type\":\"object\",\"properties\":{\"fullName\":{\"type\":\"string\",\"faker\":\"person.fullName\"}}}" --count 5 --list

# Save result to file
node dist/cli.js mock --json my-sample.json --output result.json
```

---

## 🌐 Management API Reference

### Register a New Route

`POST /_mock-server/register`

| Field              | Type     | Description                                                    |
| :----------------- | :------- | :------------------------------------------------------------- |
| `path`             | `string` | The API path (e.g., `/api/users`)                              |
| `method`           | `string` | `GET`, `POST`, `PUT`, `DELETE`                                 |
| `type`             | `string` | `typescript`, `json`, or `json-schema`                         |
| `responseDataType` | `string` | `object` or `list`                                             |
| `responseTemplate` | `object` | Optional. Wrapper structure using `{{data}}`, `{{page}}`, etc. |

**Example (TypeScript Source):**

```json
{
  "path": "/api/products",
  "method": "GET",
  "type": "typescript",
  "responseDataType": "list",
  "mainConfig": {
    "filePath": "src/models.ts",
    "typeName": "Product"
  }
}
```

### View Registered Routes

`GET /_mock-server/routes`

---

## 🧪 Advanced Mocking Strategies

### Response Templating

Custom formatting allows you to match your project's specific response structure.

```json
"responseTemplate": {
  "success": true,
  "statusCode": 200,
  "data": "{{data}}",
  "meta": {
    "currentPage": "{{page}}",
    "pageSize": "{{limit}}"
  }
}
```

### TypeScript Line Ranges

If your file has multiple interfaces and you don't want to specify a name:

```json
"mainConfig": {
  "filePath": "src/types.ts",
  "lineRange": [10, 25]
}
```

### Auto-tsconfig Detection (Fix for Absolute Paths)

The server now automatically detects the nearest `tsconfig.json` by walking up the directory tree from your `filePath`. This is crucial when mocking files from external projects or absolute paths, as it allows the engine to resolve all internal imports and aliases correctly.

---

## 📜 License

MIT - Developed by [tnnquang](https://github.com/tnnquang)
