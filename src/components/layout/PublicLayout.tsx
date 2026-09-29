import { Outlet } from "@tanstack/react-router"

export default function PublicLayout() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-5xl">
        <Outlet />
      </div>
    </main>
  )
}
