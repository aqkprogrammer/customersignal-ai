import { Check, Minus } from "lucide-react"
import { COMPARISON } from "./pricing-data"

const PLANS = ["Free", "Starter", "Pro", "Business", "Enterprise"]

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">Feature comparison across plans</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="sticky left-0 z-10 w-[34%] bg-card px-5 py-4 text-left font-medium text-muted-foreground">
              Compare plans
            </th>
            {PLANS.map((p) => (
              <th key={p} scope="col" className={p === "Pro" ? "bg-accent/60 px-4 py-4 text-center font-semibold text-primary" : "px-4 py-4 text-center font-semibold"}>
                {p}
              </th>
            ))}
          </tr>
        </thead>
        {COMPARISON.map((group) => (
          <tbody key={group.group}>
            <tr>
              <th colSpan={6} scope="colgroup" className="bg-muted/50 px-5 py-2.5 text-left font-mono text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                {group.group}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-t">
                <th scope="row" className="sticky left-0 z-10 bg-card px-5 py-3 text-left font-medium">
                  {row.label}
                </th>
                {row.values.map((v, i) => (
                  <td key={i} className={i === 2 ? "bg-accent/40 px-4 py-3 text-center" : "px-4 py-3 text-center"}>
                    {v === true ? (
                      <>
                        <Check aria-hidden className="mx-auto size-4 text-primary" />
                        <span className="sr-only">Included</span>
                      </>
                    ) : v === false ? (
                      <>
                        <Minus aria-hidden className="mx-auto size-4 text-muted-foreground/50" />
                        <span className="sr-only">Not included</span>
                      </>
                    ) : (
                      <span className="text-[13px] tabular-nums">{v}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
