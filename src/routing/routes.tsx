import { type RouteObject, createBrowserRouter } from 'react-router';

import { ErrorPage, RootErrorPage } from '@/components/ErrorPage';
import { RootLayout } from '@/layouts/RootLayout';
import { AboutPage } from '@/pages/AboutPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { CategoryLocationsPage } from '@/pages/CategoryLocationsPage';
import { CategoryPage } from '@/pages/CategoryPage';
import { HomePage } from '@/pages/HomePage';
import { MasterPage } from '@/pages/MasterPage';
import { MastersPage } from '@/pages/MastersPage';
import { MonsterPage } from '@/pages/MonsterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Nav links shown in the app bar, in order. Categories and masters are in the side nav. */
export const navItems = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
];

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RootErrorPage />,
    children: [
      {
        // Pathless route: a page that throws shows ErrorPage inside the layout,
        // so the app bar and navigation keep working.
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'categories/:slug', element: <CategoryPage /> },
          { path: 'categories/:slug/locations', element: <CategoryLocationsPage /> },
          { path: 'monsters/:slug', element: <MonsterPage /> },
          { path: 'masters', element: <MastersPage /> },
          { path: 'masters/:slug', element: <MasterPage /> },
          { path: 'about', element: <AboutPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  // BASE_URL is Vite's `base` ("/" locally, "/<repo>/" on GitHub Pages).
  return createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });
}
