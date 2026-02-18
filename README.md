# Sciro SDK

A TypeScript/JavaScript SDK for interacting with the Sciro platform API.

## Features

- 🔐 Authentication with API keys
- 📦 Full TypeScript support with type definitions
- 🚀 Promise-based async/await API
- 🔄 Automatic error handling and retries
- 📝 Comprehensive documentation
- ✅ Fully tested

## Installation

```bash
npm install sciro-sdk
```

## Quick Start

```javascript
const { SciroClient } = require('sciro-sdk');

// Initialize the client
const client = new SciroClient({
  apiKey: 'your-api-key-here'
});

// Use the SDK
async function example() {
  const user = await client.getCurrentUser();
  console.log('Current user:', user.data);
}
```

## Configuration

The SDK accepts the following configuration options:

```typescript
const client = new SciroClient({
  apiKey: 'your-api-key',           // Required: Your API key
  baseUrl: 'https://api.sciro.io',  // Optional: Custom API base URL
  timeout: 30000,                    // Optional: Request timeout in ms (default: 30000)
  headers: {                         // Optional: Custom headers
    'X-Custom-Header': 'value'
  }
});
```

## API Reference

### User Methods

#### `getCurrentUser()`

Get the currently authenticated user.

```javascript
const response = await client.getCurrentUser();
console.log(response.data); // User object
```

#### `getUser(userId)`

Get a specific user by ID.

```javascript
const response = await client.getUser('user-123');
console.log(response.data); // User object
```

### Data Methods

#### `listData(params?)`

List all data items with optional query parameters.

```javascript
const response = await client.listData({
  page: 1,
  limit: 10,
  sortBy: 'name',
  order: 'asc'
});
console.log(response.data); // Array of DataItem objects
```

#### `getData(itemId)`

Get a specific data item by ID.

```javascript
const response = await client.getData('item-123');
console.log(response.data); // DataItem object
```

#### `createData(data)`

Create a new data item.

```javascript
const response = await client.createData({
  name: 'My Data',
  value: { key: 'value' }
});
console.log(response.data); // Created DataItem
```

#### `updateData(itemId, data)`

Update an existing data item.

```javascript
const response = await client.updateData('item-123', {
  name: 'Updated Name'
});
console.log(response.data); // Updated DataItem
```

#### `deleteData(itemId)`

Delete a data item.

```javascript
await client.deleteData('item-123');
```

## Error Handling

The SDK automatically handles errors and returns a structured error object:

```javascript
try {
  const user = await client.getCurrentUser();
} catch (error) {
  console.error('Error:', error.message);
  console.error('Code:', error.code);
  console.error('Status:', error.status);
}
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { SciroClient, SciroConfig, User, DataItem } from 'sciro-sdk';

const config: SciroConfig = {
  apiKey: 'your-api-key'
};

const client = new SciroClient(config);

// All methods return properly typed responses
const response = await client.getCurrentUser();
const user: User = response.data;
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Examples

See the [examples](./examples) directory for more usage examples.

## License

MIT
