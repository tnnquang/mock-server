# Mock Server

A powerful and flexible mock server designed to generate realistic sample data and virtual APIs using TypeScript types or JSON samples. Perfect for frontend development, testing, and rapid prototyping.

## Features

- 🚀 **Dynamic API Registration**: Create and update mock endpoints at runtime.
- 📘 **TypeScript Support**: Generate mocks directly from your TS interfaces and types.
- 📄 **JSON Support**: Use static objects or separate JSON files.
- 🔢 **Pagination Handling**: Built-in support for `page` and `limit` query parameters.
- 🎨 **Custom Templates**: Define exactly how your response should look.
- 💻 **CLI Tooling**: Generate data on the fly or start the server via terminal.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/tnnquang/mock-server.git
cd mock-server

# Install dependencies
npm install

# Build the project
npm run build
```

---

## CLI Usage

### 1. `serve` (Start Server)

Starts the Express server for dynamic API mocking.

```bash
# Basic start (default port 3000)
node dist/cli.js serve

# Start on custom port with initial configuration
node dist/cli.js serve -p 4000 -c initial-config.json
```

**Options:**

- `-p, --port <number>`: Port for the server (default: 3000).
- `-c, --config <path>`: JSON file containing initial route configurations.

### 2. `mock` (Quick Data Generation)

Generate data directly to your console or a file without starting the server.

```bash
# Generate from TS interface
node dist/cli.js mock --file src/types/User.ts --type User --count 5 --list

# Generate from JSON and save to file
node dist/cli.js mock --json sample.json --output result.json
```

**Options:**

- `-f, --file <path>`: Path to the TypeScript file.
- `-t, --type <name>`: The specific interface or type name.
- `-j, --json <data|path>`: Raw JSON string or path to a `.json` file.
- `-c, --count <number>`: Items to generate (for list mode).
- `-o, --output <path>`: File to save the result.
- `--list`: Generate an array of objects.
- `--template <json>`: Custom response wrapper.

---

## API Management

The server provides a management API to register routes on the fly.

### Register a Route

**Endpoint:** `POST /_mock-server/register`

**Example Body (TypeScript Source):**

```json
{
  "path": "/api/users",
  "method": "GET",
  "type": "ts-type",
  "responseMode": "list",
  "tsOptions": {
    "filePath": "src/types.ts",
    "typeName": "User"
  }
}
```

**Example Body (JSON Source + Custom Template):**

```json
{
  "path": "/api/config",
  "method": "GET",
  "type": "json",
  "data": { "version": "1.0.0" },
  "responseTemplate": {
    "success": true,
    "payload": "{{data}}"
  }
}
```

### View All Routes

**Endpoint:** `GET /_mock-server/routes`

---

## Mocking Strategies

### TypeScript Integration

- **Direct File**: Specify `filePath` and `typeName`.
- **Line Ranges**: If multiple types are in one file, use `lineRange: [startLine, endLine]`.
- **Inline Definition**: Send a string of TS code via `typeDefinition`.

### Response Customization

Use the `responseTemplate` key to wrap your data. Tokens available:

- `{{data}}`: The generated mock data (object or list).
- `{{page}}`: Current page number.
- `{{limit}}`: Number of items requested.
- `{{total}}`: Mocked total item count.
- `{{totalPages}}`: Mocked total page count.

**Example Template:**

```json
{
  "status": "success",
  "results": "{{limit}}",
  "content": "{{data}}",
  "meta": { "page": "{{page}}" }
}
```

---

## Development Standards

Please refer to [.agent/workflows/development-standard.md](.agent/workflows/development-standard.md) for project-specific rules regarding port management and build processes.

---

## License

MIT
