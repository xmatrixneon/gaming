# Graph Report - .  (2026-06-06)

## Corpus Check
- Corpus is ~37,646 words - fits in a single context window. You may not need a graph.

## Summary
- 735 nodes · 1374 edges · 80 communities (46 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth Login Components|Auth Login Components]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Combobox Components|Combobox Components]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Command Menu|Command Menu]]
- [[_COMMUNITY_Responsive Layout|Responsive Layout]]
- [[_COMMUNITY_Project Configuration|Project Configuration]]
- [[_COMMUNITY_User Preferences|User Preferences]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Button Group|Button Group]]
- [[_COMMUNITY_Menu Bar|Menu Bar]]
- [[_COMMUNITY_Context Menu|Context Menu]]
- [[_COMMUNITY_Dropdown Menu|Dropdown Menu]]
- [[_COMMUNITY_App Layout|App Layout]]
- [[_COMMUNITY_Auth Buttons|Auth Buttons]]
- [[_COMMUNITY_Carousel|Carousel]]
- [[_COMMUNITY_Auth Checkbox|Auth Checkbox]]
- [[_COMMUNITY_App Manifest|App Manifest]]
- [[_COMMUNITY_Alert Dialog|Alert Dialog]]
- [[_COMMUNITY_Chart Components|Chart Components]]
- [[_COMMUNITY_Item Components|Item Components]]
- [[_COMMUNITY_Drawer|Drawer]]
- [[_COMMUNITY_Select Components|Select Components]]
- [[_COMMUNITY_Sheet|Sheet]]
- [[_COMMUNITY_Auth Tabs|Auth Tabs]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Navigation Menu|Navigation Menu]]
- [[_COMMUNITY_Auth Tabs Props|Auth Tabs Props]]
- [[_COMMUNITY_Package Config|Package Config]]
- [[_COMMUNITY_Pagination|Pagination]]
- [[_COMMUNITY_OTP Input|OTP Input]]
- [[_COMMUNITY_Breadcrumb|Breadcrumb]]
- [[_COMMUNITY_Empty States|Empty States]]
- [[_COMMUNITY_Popover|Popover]]
- [[_COMMUNITY_Avatar|Avatar]]
- [[_COMMUNITY_Toggle|Toggle]]
- [[_COMMUNITY_Alert|Alert]]
- [[_COMMUNITY_Sidebar Menu|Sidebar Menu]]
- [[_COMMUNITY_Accordion|Accordion]]
- [[_COMMUNITY_Native Select|Native Select]]
- [[_COMMUNITY_Agile Workflow Docs|Agile Workflow Docs]]
- [[_COMMUNITY_Design System Docs|Design System Docs]]
- [[_COMMUNITY_Hover Card|Hover Card]]
- [[_COMMUNITY_Resizable|Resizable]]
- [[_COMMUNITY_Framework Docs|Framework Docs]]
- [[_COMMUNITY_Development Docs|Development Docs]]
- [[_COMMUNITY_Badge|Badge]]
- [[_COMMUNITY_Getting Started Docs|Getting Started Docs]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_CICD Docs|CI/CD Docs]]
- [[_COMMUNITY_Sprint Docs|Sprint Docs]]
- [[_COMMUNITY_Accessibility Docs|Accessibility Docs]]
- [[_COMMUNITY_Component Patterns|Component Patterns]]
- [[_COMMUNITY_Performance Docs|Performance Docs]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_App Icons|App Icons]]
- [[_COMMUNITY_Framework Logos|Framework Logos]]
- [[_COMMUNITY_Font Config Docs|Font Config Docs]]
- [[_COMMUNITY_Path Aliases Docs|Path Aliases Docs]]
- [[_COMMUNITY_State Management Docs|State Management Docs]]
- [[_COMMUNITY_tRPC Integration Docs|tRPC Integration Docs]]
- [[_COMMUNITY_Scrum Rules Docs|Scrum Rules Docs]]
- [[_COMMUNITY_Incident Response Docs|Incident Response Docs]]
- [[_COMMUNITY_Prioritization Docs|Prioritization Docs]]
- [[_COMMUNITY_RICE Scoring Docs|RICE Scoring Docs]]
- [[_COMMUNITY_File Naming Docs|File Naming Docs]]
- [[_COMMUNITY_Security Docs|Security Docs]]
- [[_COMMUNITY_State Strategy Docs|State Strategy Docs]]
- [[_COMMUNITY_Testing Docs|Testing Docs]]
- [[_COMMUNITY_TypeScript Docs|TypeScript Docs]]
- [[_COMMUNITY_Border Radius Docs|Border Radius Docs]]
- [[_COMMUNITY_Component States Docs|Component States Docs]]
- [[_COMMUNITY_Responsive Design Docs|Responsive Design Docs]]
- [[_COMMUNITY_Spacing System Docs|Spacing System Docs]]
- [[_COMMUNITY_Typography Docs|Typography Docs]]
- [[_COMMUNITY_File Icon|File Icon]]
- [[_COMMUNITY_Deployment Docs|Deployment Docs]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 335 edges
2. `Button()` - 21 edges
3. `compilerOptions` - 16 edges
4. `useAuth()` - 11 edges
5. `AuthHeader` - 8 edges
6. `BottomNav` - 8 edges
7. `AppHeader` - 8 edges
8. `AuthButton` - 7 edges
9. `Card()` - 7 edges
10. `Separator()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `RootLayout()` --calls--> `cn()`  [EXTRACTED]
  app/layout.tsx → lib/utils.ts
- `AuthScreensContent()` --calls--> `cn()`  [EXTRACTED]
  app/login/page.tsx → lib/utils.ts
- `CasinoHomePage()` --calls--> `cn()`  [EXTRACTED]
  app/page.tsx → lib/utils.ts
- `Accordion()` --calls--> `cn()`  [EXTRACTED]
  components/ui/accordion.tsx → lib/utils.ts
- `AccordionItem()` --calls--> `cn()`  [EXTRACTED]
  components/ui/accordion.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Definition of Done Requirements** — fallow_agile_workflow_dod, fallow_coding_standards, fallow_design_system [EXTRACTED 1.00]
- **Component Development Conventions** — fallow_coding_standards_component_structure, fallow_coding_standards_import_order, fallow_coding_standards_styling, fallow_design_system_component_states [INFERRED 0.85]
- **Design Token Hierarchy** — fallow_design_system_color_system, fallow_design_system_typography, fallow_design_system_spacing, fallow_design_system_border_radius [EXTRACTED 1.00]
- **Modern Next.js Stack Configuration** — claude_nextjs_react_notes, claude_tailwind_v4, claude_shadcn_configuration, readme_font_optimization [EXTRACTED 0.85]
- **Development Workflow Setup** — claude_development_commands, readme_getting_started, claude_path_aliases [EXTRACTED 0.80]

## Communities (80 total, 34 thin omitted)

### Community 0 - "Auth Login Components"
Cohesion: 0.06
Nodes (53): AuthHeader, AuthHeaderProps, DepositPage(), NAV_ITEMS, NETWORKS, PAYMENT_METHODS, FilterStatus, HistoryPage() (+45 more)

### Community 1 - "Home Page"
Cohesion: 0.05
Nodes (48): BIG_WINS, BOTTOM_NAV_ITEMS_WITH_ICONS, CasinoHomePage(), FEATURED_GAMES, GAME_CATEGORIES, NAV_ICONS, PROMO_BANNERS, CollapsibleField (+40 more)

### Community 2 - "Combobox Components"
Cohesion: 0.08
Nodes (33): cn(), ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty(), ComboboxGroup() (+25 more)

### Community 3 - "Package Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, @base-ui/react, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @hookform/resolvers (+26 more)

### Community 4 - "Command Menu"
Cohesion: 0.09
Nodes (23): Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+15 more)

### Community 5 - "Responsive Layout"
Cohesion: 0.09
Nodes (23): useIsMobile(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction(), SidebarGroupContent() (+15 more)

### Community 6 - "Project Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "User Preferences"
Cohesion: 0.15
Nodes (17): CURRENCIES, CurrencyCode, CurrencyConfig, DEFAULT_USER_PREFERENCES, formatCurrency(), formatUserCurrency(), getCurrencyForLocale(), getCurrentCurrency() (+9 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 9 - "Button Group"
Cohesion: 0.13
Nodes (16): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+8 more)

### Community 10 - "Menu Bar"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 11 - "Context Menu"
Cohesion: 0.12
Nodes (10): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+2 more)

### Community 12 - "Dropdown Menu"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 13 - "App Layout"
Cohesion: 0.16
Nodes (11): geistMono, geistSans, inter, metadata, RootLayout(), viewport, Toaster(), Tooltip() (+3 more)

### Community 14 - "Auth Buttons"
Cohesion: 0.25
Nodes (10): AuthButton, AuthButtonProps, authButtonVariants, AuthInputProps, MethodToggle, MethodToggleProps, SignInMethod, SocialButtons (+2 more)

### Community 15 - "Carousel"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 16 - "Auth Checkbox"
Cohesion: 0.26
Nodes (6): AuthCheckbox, AuthCheckboxProps, Checkbox(), Input(), Label(), Slider()

### Community 17 - "App Manifest"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, name, orientation, scope (+4 more)

### Community 18 - "Alert Dialog"
Cohesion: 0.15
Nodes (9): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+1 more)

### Community 19 - "Chart Components"
Cohesion: 0.18
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), INITIAL_DIMENSION, THEMES (+2 more)

### Community 20 - "Item Components"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 21 - "Drawer"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 22 - "Select Components"
Cohesion: 0.18
Nodes (8): SelectContent(), SelectGroup(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 23 - "Sheet"
Cohesion: 0.18
Nodes (7): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 24 - "Auth Tabs"
Cohesion: 0.20
Nodes (6): AuthInput, AuthTabs, tabTransition, tabVariants, AuthScreensContent(), TabValue

### Community 25 - "Dev Dependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, prettier, tailwindcss, @tailwindcss/postcss, @types/node, @types/react (+2 more)

### Community 26 - "Navigation Menu"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 27 - "Auth Tabs Props"
Cohesion: 0.33
Nodes (7): AuthTabsProps, TabValue, Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 28 - "Package Config"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 29 - "Pagination"
Cohesion: 0.22
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 30 - "OTP Input"
Cohesion: 0.36
Nodes (5): OTPInput, OTPInputProps, InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 31 - "Breadcrumb"
Cohesion: 0.25
Nodes (7): Breadcrumb(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator()

### Community 32 - "Empty States"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 33 - "Popover"
Cohesion: 0.25
Nodes (4): PopoverContent(), PopoverDescription(), PopoverHeader(), PopoverTitle()

### Community 34 - "Avatar"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 35 - "Toggle"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 36 - "Alert"
Cohesion: 0.40
Nodes (5): Alert(), AlertAction(), AlertDescription(), AlertTitle(), alertVariants

### Community 37 - "Sidebar Menu"
Cohesion: 0.33
Nodes (6): Sidebar(), SidebarMenuButton(), sidebarMenuButtonVariants, SidebarRail(), SidebarTrigger(), useSidebar()

### Community 38 - "Accordion"
Cohesion: 0.40
Nodes (4): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 39 - "Native Select"
Cohesion: 0.40
Nodes (4): NativeSelect(), NativeSelectOptGroup(), NativeSelectOption(), NativeSelectProps

### Community 40 - "Agile Workflow Docs"
Cohesion: 0.50
Nodes (4): Definition of Done (DoD), Definition of Ready (DoR), Coding Standards & Conventions, Design System Guidelines

### Community 41 - "Design System Docs"
Cohesion: 0.50
Nodes (4): Styling Conventions, Color System, Dark Mode Implementation, Design Tokens

### Community 44 - "Framework Docs"
Cohesion: 0.67
Nodes (3): Next.js Breaking Changes Warning, Next.js 16 React 19 Critical Notes, Claude Code Project Guidance

### Community 45 - "Development Docs"
Cohesion: 0.67
Nodes (3): Component Development Patterns, Shadcn/ui Configuration, Tailwind CSS v4 Configuration

## Knowledge Gaps
- **183 isolated node(s):** `PAYMENT_METHODS`, `NETWORKS`, `NAV_ITEMS`, `TabValue`, `FilterStatus` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Combobox Components` to `Auth Login Components`, `Home Page`, `Command Menu`, `Responsive Layout`, `Button Group`, `Menu Bar`, `Context Menu`, `Dropdown Menu`, `App Layout`, `Auth Buttons`, `Carousel`, `Auth Checkbox`, `Alert Dialog`, `Chart Components`, `Item Components`, `Drawer`, `Select Components`, `Sheet`, `Auth Tabs`, `Navigation Menu`, `Auth Tabs Props`, `Pagination`, `OTP Input`, `Breadcrumb`, `Empty States`, `Popover`, `Avatar`, `Toggle`, `Alert`, `Sidebar Menu`, `Accordion`, `Native Select`, `Hover Card`, `Resizable`, `Badge`?**
  _High betweenness centrality (0.470) - this node is a cross-community bridge._
- **Why does `Button()` connect `Auth Login Components` to `Home Page`, `Combobox Components`, `Command Menu`, `Responsive Layout`, `Auth Buttons`, `Carousel`, `Alert Dialog`, `Sheet`, `Auth Tabs`, `Pagination`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Package Dependencies` to `Package Config`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `PAYMENT_METHODS`, `NETWORKS`, `NAV_ITEMS` to the rest of the system?**
  _214 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth Login Components` be split into smaller, more focused modules?**
  _Cohesion score 0.056338028169014086 - nodes in this community are weakly interconnected._
- **Should `Home Page` be split into smaller, more focused modules?**
  _Cohesion score 0.0546448087431694 - nodes in this community are weakly interconnected._
- **Should `Combobox Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07928118393234672 - nodes in this community are weakly interconnected._