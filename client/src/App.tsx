import { lazy, Suspense } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FiltersProvider, ThemeProvider } from "@/lib/app";
import NotFound from "@/pages/not-found";
// cada ecrã é um ficheiro à parte, descarregado só quando se abre (o SW pré-guarda-os todos para uso offline)
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Months = lazy(() => import("@/pages/months"));
const Parcels = lazy(() => import("@/pages/parcels"));
const Portfolio = lazy(() => import("@/pages/portfolio"));
const BudgetPage = lazy(() => import("@/pages/budget"));
const ExpensesPage = lazy(() => import("@/pages/expenses"));
const ClosingPage = lazy(() => import("@/pages/closing"));
const DataPage = lazy(() => import("@/pages/data"));
const HelpPage = lazy(() => import("@/pages/help"));
import { AccessGate } from "@/components/lock-screen";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/meses" component={Months} />
      <Route path="/despesas" component={ExpensesPage} />
      <Route path="/fecho" component={ClosingPage} />
      <Route path="/parcelas" component={Parcels} />
      <Route path="/carteira" component={Portfolio} />
      <Route path="/orcamento" component={BudgetPage} />
      <Route path="/dados" component={DataPage} />
      <Route path="/ajuda/:slug" component={HelpPage} />
      <Route path="/ajuda" component={HelpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <FiltersProvider>
            <Toaster />
            <AccessGate>
              <Router hook={useHashLocation}>
                <Suspense fallback={<div className="p-6 text-sm text-muted-foreground" role="status">A carregar…</div>}>
                  <AppRouter />
                </Suspense>
              </Router>
            </AccessGate>
          </FiltersProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
