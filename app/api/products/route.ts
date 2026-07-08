import { NextResponse } from 'next/server';

export async function GET() {
  // A hardcoded list of 3 sample products relevant to our inventory project
  const sampleProducts = [
    {
      id: "prod-001",
      name: "Organic Coffee Beans (1lb)",
      sku: "COF-ORG-1LB",
      quantity_in_stock: 45,
      unit_price: 14.99,
      status: "In Stock"
    },
    {
      id: "prod-002",
      name: "Ceramic Coffee Mug",
      sku: "MUG-CER-WHT",
      quantity_in_stock: 12,
      unit_price: 9.50,
      status: "Low Stock"
    },
    {
      id: "prod-003",
      name: "Espresso Machine Filters (100pk)",
      sku: "FLT-ESP-100",
      quantity_in_stock: 150,
      unit_price: 5.25,
      status: "In Stock"
    }
  ];

  // Return the data as JSON with a 200 OK status
  return NextResponse.json(sampleProducts, { status: 200 });
}
