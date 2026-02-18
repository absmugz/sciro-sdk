// Example usage of the Sciro SDK
const { SciroClient } = require('../dist');

// Initialize the client
const client = new SciroClient({
  apiKey: 'your-api-key-here',
  // Optional: customize base URL
  // baseUrl: 'https://custom.api.com',
  // Optional: set custom timeout
  // timeout: 60000,
});

async function main() {
  try {
    // Get current user
    const currentUser = await client.getCurrentUser();
    console.log('Current user:', currentUser.data);

    // List all data items
    const dataList = await client.listData({ 
      page: 1, 
      limit: 10,
      sortBy: 'name',
      order: 'asc'
    });
    console.log('Data items:', dataList.data);

    // Create a new data item
    const newItem = await client.createData({
      name: 'My Data',
      value: { key: 'value' }
    });
    console.log('Created item:', newItem.data);

    // Get a specific data item
    const item = await client.getData(newItem.data.id);
    console.log('Retrieved item:', item.data);

    // Update the data item
    const updated = await client.updateData(newItem.data.id, {
      name: 'Updated Data'
    });
    console.log('Updated item:', updated.data);

    // Delete the data item
    await client.deleteData(newItem.data.id);
    console.log('Item deleted');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main();
