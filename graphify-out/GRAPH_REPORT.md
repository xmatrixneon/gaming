# Graph Report - .  (2026-06-08)

## Corpus Check
- Corpus is ~47,772 words - fits in a single context window. You may not need a graph.

## Summary
- 1143 nodes · 1928 edges · 92 communities (75 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 5,324 input · 9,824 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth UI Components|Auth UI Components]]
- [[_COMMUNITY_Database & Drizzle ORM|Database & Drizzle ORM]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_App Layout & Auth Client|App Layout & Auth Client]]
- [[_COMMUNITY_Database Schema Types|Database Schema Types]]
- [[_COMMUNITY_Combobox Component|Combobox Component]]
- [[_COMMUNITY_Accordion & Avatar UI|Accordion & Avatar UI]]
- [[_COMMUNITY_Mobile Hooks & Sheets|Mobile Hooks & Sheets]]
- [[_COMMUNITY_Home Page Components|Home Page Components]]
- [[_COMMUNITY_Shared UI Components|Shared UI Components]]
- [[_COMMUNITY_Table Column Utilities|Table Column Utilities]]
- [[_COMMUNITY_Error & Loading States|Error & Loading States]]
- [[_COMMUNITY_Documentation & Architecture|Documentation & Architecture]]
- [[_COMMUNITY_Path Aliases & Config|Path Aliases & Config]]
- [[_COMMUNITY_User Preferences & Currency|User Preferences & Currency]]
- [[_COMMUNITY_Button & Input Components|Button & Input Components]]
- [[_COMMUNITY_Dialog & Card Components|Dialog & Card Components]]
- [[_COMMUNITY_Form Field Components|Form Field Components]]
- [[_COMMUNITY_Navigation & Menu Components|Navigation & Menu Components]]
- [[_COMMUNITY_Carousel & Slider Components|Carousel & Slider Components]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 351 edges
2. `Button()` - 23 edges
3. `useAuth()` - 19 edges
4. `compilerOptions` - 16 edges
5. `columns` - 14 edges
6. `AppHeader` - 13 edges
7. `columns` - 13 edges
8. `public.account` - 11 edges
9. `public.session` - 11 edges
10. `public.user` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Mobile-First Design Strategy` --implemented_by--> `app/layout.tsx`  [INFERRED]
  CLAUDE.md → app/layout.tsx
- `Next.js 16 Agent Rules` --semantically_similar_to--> `Next.js 16 Breaking Changes`  [INFERRED] [semantically similar]
  AGENTS.md → CLAUDE.md
- `DepositLoading()` --calls--> `cn()`  [EXTRACTED]
  app/deposit/loading.tsx → lib/utils.ts
- `Error()` --calls--> `cn()`  [EXTRACTED]
  app/error.tsx → lib/utils.ts
- `RootLayout()` --calls--> `cn()`  [EXTRACTED]
  app/layout.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **tRPC Client-Server Architecture** — claudlibtrpc_client, claudlibtrpc_server, claudlibtrpc_types, claudlibtrpc_hooks, claudlibtrpc_index, claudserver_routers [INFERRED 0.85]
- **Mobile-First Optimization Stack** — claude_mobilefirst, claude_mobilehandling, claudapp_layout, claudapp_globalscss, claudnext_config [INFERRED 0.85]
- **Authentication Implementation Strategy** — claude_autharchitecture, claudhooks_useauth, claudmock_user, claude_mockprod, claudserver_routers [INFERRED 0.85]
- **BC Brand Package** — public_icon_512_app_icon, public_icon_512_design_system, public_icon_512_brand_identity, public_icon_512_visual_element [EXTRACTED 1.00]

## Communities (92 total, 17 thin omitted)

### Community 0 - "Auth UI Components"
Cohesion: 0.06
Nodes (42): CollapsibleField, CollapsibleFieldProps, BottomNavProps, NavItem, CategoryTab, CategoryTabs, CategoryTabsProps, GameCard (+34 more)

### Community 1 - "Database & Drizzle ORM"
Cohesion: 0.06
Nodes (25): { GET, POST }, client, db, Account, accountRelations, NewAccount, NewSession, NewUser (+17 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.04
Nodes (50): dependencies, @base-ui/react, better-auth, @better-auth/drizzle-adapter, @better-auth/redis-storage, bullmq, class-variance-authority, clsx (+42 more)

### Community 3 - "App Layout & Auth Client"
Cohesion: 0.07
Nodes (38): geistMono, geistSans, inter, metadata, RootLayout(), viewport, authClient, Session (+30 more)

### Community 4 - "Database Schema Types"
Cohesion: 0.04
Nodes (49): default, name, notNull, primaryKey, type, balance, email, email_verified (+41 more)

### Community 5 - "Combobox Component"
Cohesion: 0.05
Nodes (38): ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty(), ComboboxGroup(), ComboboxInput() (+30 more)

### Community 6 - "Accordion & Avatar UI"
Cohesion: 0.07
Nodes (36): cn(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), Avatar(), AvatarBadge(), AvatarFallback() (+28 more)

### Community 7 - "Mobile Hooks & Sheets"
Cohesion: 0.06
Nodes (37): useIsMobile(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle() (+29 more)

### Community 8 - "Home Page Components"
Cohesion: 0.08
Nodes (31): BIG_WINS, BOTTOM_NAV_ITEMS_WITH_ICONS, CasinoHomePage(), FEATURED_GAMES, GAME_CATEGORIES, NAV_ICONS, PROMO_BANNERS, AuthInput (+23 more)

### Community 9 - "Shared UI Components"
Cohesion: 0.13
Nodes (18): hoverTransition, AppHeaderProps, BalanceCardProps, DividerProps, GradientCard, GradientCardProps, MethodCard(), MethodCardProps (+10 more)

### Community 10 - "Table Column Utilities"
Cohesion: 0.08
Nodes (25): columnsFrom, columnsTo, name, onDelete, onUpdate, tableFrom, tableTo, columns (+17 more)

### Community 11 - "Error & Loading States"
Cohesion: 0.13
Nodes (15): Error(), Loading(), NotFound(), DepositLoading(), FilterStatus, HistoryPage(), NAV_ITEMS, TabValue (+7 more)

### Community 12 - "Documentation & Architecture"
Cohesion: 0.09
Nodes (22): app/globals.css, app/layout.tsx, Intent Skills Loading System, Next.js 16 Agent Rules, Authentication Architecture, ClausBet Project, Component Organization Strategy, Multi-Currency and i18n Architecture (+14 more)

### Community 13 - "Path Aliases & Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 14 - "User Preferences & Currency"
Cohesion: 0.15
Nodes (17): CURRENCIES, CurrencyCode, CurrencyConfig, DEFAULT_USER_PREFERENCES, formatCurrency(), formatUserCurrency(), getCurrencyForLocale(), getCurrentCurrency() (+9 more)

### Community 15 - "Button & Input Components"
Cohesion: 0.09
Nodes (22): checkConstraints, compositePrimaryKeys, foreignKeys, indexes, isRLSEnabled, name, policies, schema (+14 more)

### Community 16 - "Dialog & Card Components"
Cohesion: 0.13
Nodes (16): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+8 more)

### Community 17 - "Form Field Components"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 18 - "Navigation & Menu Components"
Cohesion: 0.18
Nodes (13): AuthButton, AuthButtonProps, authButtonVariants, AuthCheckboxProps, AuthHeader, AuthHeaderProps, AuthInputProps, INDIA_CODE (+5 more)

### Community 19 - "Carousel & Slider Components"
Cohesion: 0.22
Nodes (8): OTPInput, OTPInputProps, Checkbox(), Input(), InputOTP(), InputOTPGroup(), InputOTPSlot(), Label()

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (10): ForgotPasswordState, initialState, Step, Divider, initialState, SignInForm(), SignInFormProps, SignInMethod (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (10): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (13): devDependencies, eslint, eslint-config-next, jsdom, prettier, tailwindcss, @tailwindcss/postcss, @types/node (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, name, orientation, scope (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (9): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), INITIAL_DIMENSION, THEMES (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (9): AuthTabs, AuthTabsProps, TabValue, tabTransition, Tabs(), TabsContent(), TabsList(), tabsListVariants (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.27
Nodes (8): MethodToggle, MethodToggleProps, SignInMethod, ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (10): dialect, enums, id, policies, prevId, roles, schemas, sequences (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (11): name, notNull, primaryKey, type, access_token_expires_at, password, name, notNull (+3 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (11): identifier, value, name, notNull, primaryKey, type, columns, name (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (11): ip_address, token, name, notNull, primaryKey, type, columns, name (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (8): SelectContent(), SelectGroup(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (7): AuthCheckbox, initialState, SignUpState, SignUpStep1Props, SignUpStep2Props, Step, TabValue

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (9): session_user_id_user_id_fk, foreignKeys, columnsFrom, columnsTo, name, onDelete, onUpdate, tableFrom (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (9): checkConstraints, compositePrimaryKeys, foreignKeys, isRLSEnabled, name, policies, schema, uniqueConstraints (+1 more)

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 43 - "Community 43"
Cohesion: 0.22
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (7): account, accountRelations, session, sessionRelations, user, userRelations, verification

### Community 45 - "Community 45"
Cohesion: 0.25
Nodes (8): session_userId_idx, indexes, columns, concurrently, isUnique, method, name, with

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (8): verification_identifier_idx, indexes, columns, concurrently, isUnique, method, name, with

### Community 47 - "Community 47"
Cohesion: 0.25
Nodes (8): checkConstraints, compositePrimaryKeys, isRLSEnabled, name, policies, schema, tables, public.session

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (4): PopoverContent(), PopoverDescription(), PopoverHeader(), PopoverTitle()

### Community 50 - "Community 50"
Cohesion: 0.38
Nodes (6): createIcon(), fs, generateIcons(), path, publicDir, sharp

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (6): created_at, default, name, notNull, primaryKey, type

### Community 52 - "Community 52"
Cohesion: 0.40
Nodes (5): Alert(), AlertAction(), AlertDescription(), AlertTitle(), alertVariants

### Community 53 - "Community 53"
Cohesion: 0.40
Nodes (5): name, notNull, primaryKey, type, access_token

### Community 54 - "Community 54"
Cohesion: 0.40
Nodes (5): name, notNull, primaryKey, type, account_id

### Community 55 - "Community 55"
Cohesion: 0.40
Nodes (5): expires_at, name, notNull, primaryKey, type

### Community 56 - "Community 56"
Cohesion: 0.40
Nodes (5): id, name, notNull, primaryKey, type

### Community 57 - "Community 57"
Cohesion: 0.40
Nodes (5): id_token, name, notNull, primaryKey, type

### Community 58 - "Community 58"
Cohesion: 0.40
Nodes (5): provider_id, name, notNull, primaryKey, type

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (5): refresh_token, name, notNull, primaryKey, type

### Community 60 - "Community 60"
Cohesion: 0.40
Nodes (5): refresh_token_expires_at, name, notNull, primaryKey, type

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (5): scope, name, notNull, primaryKey, type

### Community 62 - "Community 62"
Cohesion: 0.40
Nodes (5): updated_at, name, notNull, primaryKey, type

### Community 63 - "Community 63"
Cohesion: 0.40
Nodes (5): user_agent, name, notNull, primaryKey, type

### Community 64 - "Community 64"
Cohesion: 0.40
Nodes (5): user_id, name, notNull, primaryKey, type

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (5): uniqueConstraints, columns, name, nullsNotDistinct, session_token_unique

### Community 66 - "Community 66"
Cohesion: 0.40
Nodes (4): NativeSelect(), NativeSelectOptGroup(), NativeSelectOption(), NativeSelectProps

### Community 67 - "Community 67"
Cohesion: 0.50
Nodes (4): _meta, columns, schemas, tables

### Community 68 - "Community 68"
Cohesion: 0.50
Nodes (3): dialect, entries, version

### Community 69 - "Community 69"
Cohesion: 0.83
Nodes (4): BC App Icon, BC Brand Identity, App Icon Design System, Green Background with White Text

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (3): ClausBet Application Logo/Icon, BC Brand Identity Design, Minimalist Green Logo Design Pattern

## Knowledge Gaps
- **447 isolated node(s):** `{ GET, POST }`, `PAYMENT_CATEGORIES`, `NAV_ITEMS`, `Step`, `ForgotPasswordState` (+442 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Accordion & Avatar UI` to `Auth UI Components`, `App Layout & Auth Client`, `Combobox Component`, `Mobile Hooks & Sheets`, `Home Page Components`, `Shared UI Components`, `Error & Loading States`, `Dialog & Card Components`, `Navigation & Menu Components`, `Carousel & Slider Components`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 43`, `Community 48`, `Community 49`, `Community 52`, `Community 66`, `Community 70`, `Community 71`, `Community 73`?**
  _High betweenness centrality (0.309) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Package Dependencies` to `Community 42`, `App Layout & Auth Client`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `@trpc/server` connect `App Layout & Auth Client` to `Package Dependencies`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `{ GET, POST }`, `PAYMENT_CATEGORIES`, `NAV_ITEMS` to the rest of the system?**
  _452 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06219426974143955 - nodes in this community are weakly interconnected._
- **Should `Database & Drizzle ORM` be split into smaller, more focused modules?**
  _Cohesion score 0.05877551020408163 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._