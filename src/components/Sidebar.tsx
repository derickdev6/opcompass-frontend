import {
  BriefcaseBusiness,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Compass,
  Contact,
  Landmark,
  LayoutDashboard,
  MapPin,
  Network,
  ScrollText,
  Tags,
  UserCog,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { NavLink, useMatch } from "react-router-dom"

import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface NavSection {
  heading: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    heading: "People",
    items: [
      { to: "/directory", label: "Directory", icon: Users },
      { to: "/people", label: "People", icon: Contact },
      { to: "/employments", label: "Employments", icon: ClipboardList },
    ],
  },
  {
    heading: "Organisation",
    items: [
      { to: "/org-chart", label: "Org chart", icon: Network },
      { to: "/org-units", label: "Org units", icon: Building2 },
      { to: "/positions", label: "Positions", icon: Tags },
      { to: "/job-titles", label: "Job titles", icon: BriefcaseBusiness },
      { to: "/locations", label: "Locations", icon: MapPin },
      { to: "/legal-entities", label: "Legal entities", icon: Landmark },
    ],
  },
  {
    heading: "System",
    items: [
      { to: "/users", label: "Users", icon: UserCog },
      { to: "/audit", label: "Audit log", icon: ScrollText },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        // overflow-hidden matters: labels are still in the DOM mid-collapse and
        // would otherwise spill across the content area while the width animates.
        "flex h-svh shrink-0 flex-col overflow-hidden border-r bg-card",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 items-center border-b",
          collapsed ? "justify-center px-0" : "px-4",
        )}
      >
        <Compass className="size-5 shrink-0 text-primary" aria-hidden />
        {!collapsed && (
          <span className="ml-2 truncate font-semibold tracking-tight">
            OP Compass
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {SECTIONS.map((section, index) => (
          <div key={section.heading}>
            {index > 0 && collapsed && <Separator className="my-2" />}
            {!collapsed && (
              <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {section.heading}
              </p>
            )}
            {/* px-2 is the whole margin when collapsed: the tiles below are
                full-width, so this is what keeps them off the edges. */}
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-5 shrink-0" aria-hidden />
          ) : (
            <>
              <ChevronsLeft className="size-4 shrink-0" aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { icon: Icon } = item

  // The active state is resolved here rather than through NavLink's
  // `className` callback. When collapsed, the link is wrapped in
  // <TooltipTrigger asChild>, and Radix's Slot merges `className` by
  // string-joining — a function is stringified into the class attribute and
  // every style on the link silently disappears. A plain string survives both
  // paths.
  const isActive = useMatch({ path: item.to, end: item.end ?? false }) !== null

  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      className={cn(
        // Collapsed tiles span the panel's full width, inset only by the
        // list's px-2, so the target is the whole strip rather than a small
        // square floating in it.
        "flex h-9 w-full items-center rounded-md text-sm transition-colors",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        isActive
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {/* Bigger when collapsed: with no label beside it, the icon is the only
          thing carrying the item's meaning. */}
      <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-4")} aria-hidden />
      {/* Collapsed mode is icons only; the label is still announced to screen
          readers via the tooltip content below. */}
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="sr-only">{item.label}</span>}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}
