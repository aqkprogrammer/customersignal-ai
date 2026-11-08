import { connection } from "next/server"
import { Suspense } from "react"

async function Connection() {
  await connection()
  return null
}

/** Marks a dynamic-param route as request-time rendered (Cache Components) without blocking its static shell. */
export function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  )
}
