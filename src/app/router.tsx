import { createRouter, createRoute, createRootRoute, redirect, lazyRouteComponent } from '@tanstack/react-router'
import AppLayout from '../components/layout/AppLayout'
import PublicLayout from '../components/layout/PublicLayout'

const LoginPage = lazyRouteComponent(() => import('../pages/LoginPage'))
const TripsPage = lazyRouteComponent(() => import('../pages/TripsPage'))
const CreateTripPage = lazyRouteComponent(() => import('../pages/CreateTripPage'))
const TripDashboardPage = lazyRouteComponent(() => import('../pages/TripDashboardPage'))
const ExpensesPage = lazyRouteComponent(() => import('../pages/ExpensesPage'))
const AddExpensePage = lazyRouteComponent(() => import('../pages/AddExpensePage'))
const EditExpensePage = lazyRouteComponent(() => import('../pages/EditExpensePage'))
const MembersPage = lazyRouteComponent(() => import('../pages/MembersPage'))
const MemberDetailPage = lazyRouteComponent(() => import('../pages/MemberDetailPage'))
const FundsPage = lazyRouteComponent(() => import('../pages/FundsPage'))
const ActivityPage = lazyRouteComponent(() => import('../pages/ActivityPage'))
const TripSettingsPage = lazyRouteComponent(() => import('../pages/TripSettingsPage'))
const SharedTripPage = lazyRouteComponent(() => import('../pages/SharedTripPage'))
const NotFoundPage = lazyRouteComponent(() => import('../pages/NotFoundPage'))

const rootRoute = createRootRoute({
  notFoundComponent: NotFoundPage,
  errorComponent: ({ reset }) => (
    <div role="alert" className="min-h-screen grid place-content-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">This page could not be loaded</h1>
      <p>Try again, or reload to get the latest version.</p>
      <button className="text-primary underline" onClick={reset}>Try again</button>
      <button className="text-primary underline" onClick={() => window.location.reload()}>Reload</button>
    </div>
  ),
})

// Root index — redirect / → /login
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/login' })
  },
})

const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public',
  component: PublicLayout,
})

const loginRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: '/login',
  component: LoginPage,
})

const sharedRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: '/shared/$tripName/$shareToken',
  component: SharedTripPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppLayout,
})

const tripsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/trips',
  validateSearch: (search: Record<string, unknown>): { all?: boolean } => ({
    all: search.all === true || search.all === 'true' ? true : undefined,
  }),
  component: TripsPage,
})

const createTripRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/trips/new',
  component: CreateTripPage,
})

const tripDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/trips/$tripId',
})

const tripDashboardRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/',
  component: TripDashboardPage,
})

const tripExpensesRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/expenses',
  component: ExpensesPage,
})

const addExpenseRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/expenses/new',
  validateSearch: (search: Record<string, unknown>): { prefillMemberId?: string } => {
    return {
      prefillMemberId: search.prefillMemberId as string | undefined,
    }
  },
  component: AddExpensePage,
})

const editExpenseRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/expenses/$expenseId/edit',
  component: EditExpensePage,
})

const membersRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/members',
  component: MembersPage,
})

const memberDetailRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/members/$memberId',
  component: MemberDetailPage,
})

const fundsRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/funds',
  component: FundsPage,
})

const activityRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/activity',
  component: ActivityPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => tripDetailRoute,
  path: '/settings',
  component: TripSettingsPage,
})

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: NotFoundPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  publicRoute.addChildren([loginRoute, sharedRoute]),
  appRoute.addChildren([
    tripsRoute,
    createTripRoute,
    tripDetailRoute.addChildren([
      tripDashboardRoute,
      tripExpensesRoute,
      addExpenseRoute,
      editExpenseRoute,
      membersRoute,
      memberDetailRoute,
      fundsRoute,
      activityRoute,
      settingsRoute,
    ]),
  ]),
  notFoundRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
