"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"

export default function AdminButton() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("users")
        .select("rolle")
        .eq("id", user.id)
        .single()

      if (data?.rolle === "admin") {
        setIsAdmin(true)
      }
    }
    checkAdmin()
  }, [])

  if (!isAdmin) return null

  return (
    <Link
      href="/admin"
      className="fixed bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50 transition-colors"
    >
      <span>{"🏠"}</span>
      <span className="text-sm font-medium">Admin</span>
    </Link>
  )
}
