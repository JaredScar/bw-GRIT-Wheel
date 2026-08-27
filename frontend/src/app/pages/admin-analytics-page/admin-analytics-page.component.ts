import { Component, inject, OnInit, signal } from '@angular/core';
import { AnalyticsSummary } from '../../models/analytics.model';
import { GRIT_CATEGORY_LABELS, GritCategory } from '../../models/grit-category';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-admin-analytics-page',
  standalone: true,
  templateUrl: './admin-analytics-page.component.html',
  styleUrl: './admin-analytics-page.component.scss',
})
export class AdminAnalyticsPageComponent implements OnInit {
  private readonly analyticsService = inject(AnalyticsService);

  readonly categoryLabels = GRIT_CATEGORY_LABELS;
  readonly analytics = signal<AnalyticsSummary | null>(null);
  readonly loadingAnalytics = signal(false);

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.loadingAnalytics.set(true);
    this.analyticsService.getSummary().subscribe({
      next: (summary) => {
        this.analytics.set(summary);
        this.loadingAnalytics.set(false);
      },
      error: () => this.loadingAnalytics.set(false),
    });
  }

  barWidth(count: number, rows: { count: number }[]): number {
    const max = Math.max(...rows.map((r) => r.count), 1);
    return (count / max) * 100;
  }

  categoryBadgeClass(category: GritCategory): string {
    return `badge-${category.toLowerCase()}`;
  }
}
