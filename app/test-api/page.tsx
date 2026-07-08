'use client';

import { useState } from 'react';

export default function TestApiPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Make a GET request to our new API route
      const response = await fetch('/api/products');
      
      // Capture the HTTP status code
      setStatus(response.status);
      
      // Parse the JSON body
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch:', error);
      setData({ error: "Failed to fetch data" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>API Testing Page</h1>
      <p>Use this page to test HTTP requests to the <code>/api/products</code> route.</p>
      
      <button 
        onClick={fetchProducts} 
        disabled={loading}
        style={{ padding: '10px 20px', cursor: 'pointer', marginBottom: '20px' }}
      >
        {loading ? 'Fetching...' : 'GET Products'}
      </button>

      {status !== null && (
        <div style={{ marginBottom: '10px' }}>
          <strong>Response Status: </strong> 
          <span style={{ 
            backgroundColor: status === 200 ? 'green' : 'red', 
            color: 'white', 
            padding: '2px 8px', 
            borderRadius: '4px' 
          }}>
            {status} {status === 200 ? 'OK' : 'Error'}
          </span>
        </div>
      )}

      {data && (
        <div style={{ marginTop: '20px' }}>
          <h3>JSON Response:</h3>
          <pre style={{ 
            backgroundColor: '#f4f4f4', 
            padding: '15px', 
            borderRadius: '5px',
            overflowX: 'auto'
          }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
