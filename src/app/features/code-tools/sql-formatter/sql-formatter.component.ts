import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-sql-formatter',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="sql-formatter-tool p-3">
      <app-tool-header
        title="SQL Formatter & Beautifier"
        description="Format, align, and clean messy SQL queries with configurable keyword casing and indentation rules."
        icon="bi-database"
        toolId="sql-formatter"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputSql"
        [showDownloadBtn]="true"
        [downloadContent]="outputSql"
        downloadFilename="query.sql"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- SQL Options Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <!-- Keyword Casing -->
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Keywords:</label>
              <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="keywordCasing" (ngModelChange)="formatSql()">
                <option value="upper">UPPERCASE</option>
                <option value="lower">lowercase</option>
                <option value="preserve">Preserve</option>
              </select>
            </div>

            <!-- Indentation -->
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Indent:</label>
              <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="indentation" (ngModelChange)="formatSql()">
                <option [ngValue]="2">2 Spaces</option>
                <option [ngValue]="4">4 Spaces</option>
                <option [ngValue]="'tab'">Tab</option>
              </select>
            </div>
          </div>

          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-sm btn-secondary-accent d-flex align-items-center gap-1" (click)="minifySql()">
              <i class="bi bi-arrows-collapse"></i>
              <span>Minify</span>
            </button>
            <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="formatSql()">
              <i class="bi bi-text-indent-left"></i>
              <span>Format Query</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Editors -->
      <div class="row g-3">
        <div class="col-lg-6">
          <app-code-editor
            title="Raw SQL Query"
            language="sql"
            [value]="inputSql"
            (valueChange)="onInputChange($event)"
            placeholder="Paste raw SQL query here..."
            height="480px"
          ></app-code-editor>
        </div>

        <div class="col-lg-6">
          <app-code-editor
            title="Formatted SQL Output"
            language="sql"
            [value]="outputSql"
            [readOnly]="true"
            placeholder="Formatted SQL will appear here..."
            height="480px"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class SqlFormatterComponent {
  private notifyService = inject(NotificationService);

  public inputSql = '';
  public outputSql = '';
  public keywordCasing: 'upper' | 'lower' | 'preserve' = 'upper';
  public indentation: number | string = 2;

  private readonly SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING',
    'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN',
    'CROSS JOIN', 'ON', 'AS', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
    'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE', 'UNION', 'UNION ALL', 'EXISTS',
    'IN', 'NOT IN', 'LIKE', 'BETWEEN', 'IS NULL', 'IS NOT NULL', 'CASE', 'WHEN',
    'THEN', 'ELSE', 'END', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'
  ];

  onInputChange(val: string): void {
    this.inputSql = val;
    this.formatSql();
  }

  formatSql(): void {
    if (!this.inputSql.trim()) {
      this.outputSql = '';
      return;
    }

    const indentStr = this.indentation === 'tab' ? '\t' : ' '.repeat(Number(this.indentation));

    // Normalize spacing
    let sql = this.inputSql.replace(/\s+/g, ' ').trim();

    // Major clause breaks
    const majorClauses = [
      'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
      'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'JOIN',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'UNION ALL', 'UNION'
    ];

    for (const clause of majorClauses) {
      const reg = new RegExp(`\\b${clause}\\b`, 'gi');
      sql = sql.replace(reg, `\n${clause}`);
    }

    // Split into lines and format
    const lines = sql.split('\n').filter(l => l.trim().length > 0);
    const formattedLines: string[] = [];

    for (let line of lines) {
      line = line.trim();

      // Keyword casing transformation
      if (this.keywordCasing === 'upper') {
        for (const kw of this.SQL_KEYWORDS) {
          const reg = new RegExp(`\\b${kw}\\b`, 'gi');
          line = line.replace(reg, kw.toUpperCase());
        }
      } else if (this.keywordCasing === 'lower') {
        for (const kw of this.SQL_KEYWORDS) {
          const reg = new RegExp(`\\b${kw}\\b`, 'gi');
          line = line.replace(reg, kw.toLowerCase());
        }
      }

      // Indent sub-clauses
      const startsWithMajor = majorClauses.some(mc => line.toUpperCase().startsWith(mc));
      if (!startsWithMajor && formattedLines.length > 0) {
        line = `${indentStr}${line}`;
      }

      formattedLines.push(line);
    }

    this.outputSql = formattedLines.join('\n');
  }

  minifySql(): void {
    if (!this.inputSql.trim()) {
      this.outputSql = '';
      return;
    }
    this.outputSql = this.inputSql.replace(/\s+/g, ' ').trim();
    this.notifyService.info('Minified SQL');
  }

  loadSampleData(): void {
    this.inputSql = `select u.id, u.first_name, u.email, count(o.id) as total_orders, sum(o.amount) as total_spent from users u left join orders o on u.id = o.user_id where u.is_active = 1 and u.created_at >= '2026-01-01' group by u.id, u.first_name, u.email having count(o.id) > 5 order by total_spent desc limit 50;`;
    this.formatSql();
    this.notifyService.info('Sample SQL query loaded');
  }

  clearAll(): void {
    this.inputSql = '';
    this.outputSql = '';
  }
}

