import type { InvoiceSheet } from "@/lib/invoice-view";

export function InvoiceSheetView({ sheet }: { sheet: InvoiceSheet }) {
  return (
    <article className="invoice-sheet">
      <header className="invoice-brand">
        <h1>{sheet.brand}</h1>
        <p>ინვოისი · {sheet.ref}</p>
      </header>

      <table className="invoice-details">
        <tbody>
          {sheet.details.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="invoice-lines">
        <tbody>
          {sheet.lines.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.amount}</td>
            </tr>
          ))}
          {sheet.discount && (
            <tr>
              <td>{sheet.discount.label}</td>
              <td>{sheet.discount.amount}</td>
            </tr>
          )}
          <tr className="invoice-total">
            <th scope="row">{sheet.totalLabel}</th>
            <td>{sheet.total}</td>
          </tr>
        </tbody>
      </table>

      <section className="invoice-bank">
        <p>{sheet.bankIntro}</p>
        <table>
          <tbody>
            {sheet.bank.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="invoice-thanks">{sheet.thanks}</p>
    </article>
  );
}
