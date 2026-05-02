interface LineItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
}

interface LineItemsTableProps {
  items: LineItem[];
  editable?: boolean;
  onChange?: (items: LineItem[]) => void;
}

export default function LineItemsTable({ items, editable, onChange }: LineItemsTableProps) {
  void onChange;

  return (
    <table className="line-items">
      <thead>
        <tr>
          <th className="line-items__th">Description</th>
          <th className="line-items__th">Qty</th>
          <th className="line-items__th">Unit Price</th>
          <th className="line-items__th">Total</th>
          {editable && <th className="line-items__th" />}
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className="line-items__row">
            <td className="line-items__td">{item.description}</td>
            <td className="line-items__td">{item.qty}</td>
            <td className="line-items__td">${item.unit_price.toFixed(2)}</td>
            <td className="line-items__td">${item.total.toFixed(2)}</td>
            {editable && (
              <td className="line-items__td">
                <button className="line-items__remove">×</button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
