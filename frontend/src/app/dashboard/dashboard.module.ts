import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpClientModule} from "@angular/common/http";
import {NgbTooltipModule} from '@ng-bootstrap/ng-bootstrap';

import {DashboardRoutingModule} from './dashboard-routing.module';
import {DashboardComponent} from './dashboard/dashboard.component';
import {CardComponent} from './card/card.component';
import {TruncatePipe} from '../pipes/truncate.pipe';
import {TokenComponent} from './token/token.component';

@NgModule({
  declarations: [
    DashboardComponent,
    CardComponent,
    TruncatePipe,
    TokenComponent,
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    HttpClientModule,
    NgbTooltipModule,
  ],
})
export class DashboardModule {
}
