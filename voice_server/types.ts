
export interface ReceiptItem {
  description: string;
  quantity: number;
  price: number;
}

export interface Receipt {
  merchant_name: string;
  transaction_date: string;
  items: ReceiptItem[];
  total_amount: number;
}
