import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {SettingsModalComponent} from './modals';

const routes: Routes = [
  {path: 'dashboard', loadChildren: () => import('./dashboard/dashboard.module').then(p => p.DashboardModule)},
  {path: 'settings', component: SettingsModalComponent},
  {path: 'poll', loadChildren: () => import('./poll/poll.module').then(p => p.PollModule)},
  {path: 'about', loadChildren: () => import('./about/about.module').then(p => p.AboutModule)},
  {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {
}
