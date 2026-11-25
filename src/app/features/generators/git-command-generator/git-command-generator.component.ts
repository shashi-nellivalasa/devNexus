import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { NotificationService } from '../../../core/services/notification.service';

interface GeneratedGitResult {
  command: string;
  explanation: string;
  warnings?: string;
  steps: string[];
}

@Component({
  selector: 'app-git-command-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToolHeaderComponent],
  template: `
    <div class="git-generator-tool p-3">
      <app-tool-header
        title="Git Command Generator"
        description="Visually construct exact, error-free Git commands for branching, committing, rebasing, cherry-picking, and undoing changes."
        icon="bi-git"
        toolId="git-generator"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="result.command"
        (loadSample)="loadSampleData()"
        (clear)="resetForm()"
      ></app-tool-header>

      <!-- Operation Selector Tabs -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap gap-2 mb-3 border-bottom border-secondary border-opacity-25 pb-3">
          @for (op of operations; track op.id) {
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="activeOperation === op.id ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="selectOperation(op.id)"
            >
              <i class="bi" [ngClass]="op.icon" class="me-1"></i>
              <span>{{ op.name }}</span>
            </button>
          }
        </div>

        <!-- Dynamic Form Fields Based on Operation -->
        <form [formGroup]="gitForm">
          @switch (activeOperation) {
            @case ('branch') {
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">Action:</label>
                  <select class="form-select form-select-sm bg-dark-subtle border-secondary border-opacity-50 text-light" formControlName="branchAction">
                    <option value="create_and_switch">Create & Switch to New Branch</option>
                    <option value="switch">Switch Existing Branch</option>
                    <option value="rename">Rename Current Branch</option>
                    <option value="delete_local">Delete Local Branch</option>
                    <option value="delete_remote">Delete Remote Branch</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">Branch Name:</label>
                  <input type="text" class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono" formControlName="branchName" placeholder="feature/user-auth" />
                </div>
              </div>
            }

            @case ('commit') {
              <div class="row g-3">
                <div class="col-md-3">
                  <label class="form-label small text-secondary mb-1">Type:</label>
                  <select class="form-select form-select-sm bg-dark-subtle border-secondary border-opacity-50 text-light" formControlName="commitType">
                    <option value="feat">feat: New Feature</option>
                    <option value="fix">fix: Bug Fix</option>
                    <option value="refactor">refactor: Code Restructure</option>
                    <option value="chore">chore: Maintenance</option>
                    <option value="docs">docs: Documentation</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label small text-secondary mb-1">Commit Message:</label>
                  <input type="text" class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono" formControlName="commitMessage" placeholder="add reactive forms and validation" />
                </div>
                <div class="col-md-3 d-flex align-items-center pt-3">
                  <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="stageAllCheck" formControlName="commitStageAll">
                    <label class="form-check-label small text-secondary" for="stageAllCheck">Stage all files (-A)</label>
                  </div>
                </div>
              </div>
            }

            @case ('rebase') {
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">Rebase Type:</label>
                  <select class="form-select form-select-sm bg-dark-subtle border-secondary border-opacity-50 text-light" formControlName="rebaseType">
                    <option value="interactive">Interactive Rebase (Last N commits)</option>
                    <option value="onto_branch">Rebase Onto Base Branch</option>
                    <option value="continue">Continue Pending Rebase</option>
                    <option value="abort">Abort Pending Rebase</option>
                  </select>
                </div>
                @if (gitForm.value.rebaseType === 'interactive') {
                  <div class="col-md-3">
                    <label class="form-label small text-secondary mb-1">Number of Commits:</label>
                    <input type="number" class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono" formControlName="rebaseCount" min="1" max="50" />
                  </div>
                }
                @if (gitForm.value.rebaseType === 'onto_branch') {
                  <div class="col-md-4">
                    <label class="form-label small text-secondary mb-1">Target Base Branch:</label>
                    <input type="text" class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono" formControlName="rebaseTargetBranch" placeholder="main" />
                  </div>
                }
              </div>
            }

            @case ('reset') {
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">Reset Mode:</label>
                  <select class="form-select form-select-sm bg-dark-subtle border-secondary border-opacity-50 text-light" formControlName="resetMode">
                    <option value="soft">Soft (--soft: Keep files & staging)</option>
                    <option value="mixed">Mixed (--mixed: Keep files, unstage)</option>
                    <option value="hard">Hard (--hard: DISCARD ALL CHANGES)</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">Target Commit / Offset:</label>
                  <input type="text" class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono" formControlName="resetTarget" placeholder="HEAD~1" />
                </div>
              </div>
            }

            @case ('stash') {
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">Stash Action:</label>
                  <select class="form-select form-select-sm bg-dark-subtle border-secondary border-opacity-50 text-light" formControlName="stashAction">
                    <option value="push">Save Changes (stash push)</option>
                    <option value="pop">Restore Most Recent (stash pop)</option>
                    <option value="list">List Stashed Items</option>
                    <option value="clear">Drop All Stashes</option>
                  </select>
                </div>
                @if (gitForm.value.stashAction === 'push') {
                  <div class="col-md-5">
                    <label class="form-label small text-secondary mb-1">Stash Message:</label>
                    <input type="text" class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono" formControlName="stashMessage" placeholder="WIP on API tester" />
                  </div>
                  <div class="col-md-3 d-flex align-items-center pt-3">
                    <div class="form-check form-switch mb-0">
                      <input class="form-check-input" type="checkbox" id="untrackedCheck" formControlName="stashUntracked">
                      <label class="form-check-label small text-secondary" for="untrackedCheck">Include untracked (-u)</label>
                    </div>
                  </div>
                }
              </div>
            }
          }
        </form>
      </div>

      <!-- Generated Command Display Card -->
      <div class="dn-card p-4">
        <div class="d-flex align-items-center justify-content-between mb-3 border-bottom border-secondary border-opacity-25 pb-2">
          <span class="small fw-bold text-light d-flex align-items-center gap-2">
            <i class="bi bi-terminal-fill text-info"></i>
            <span>Generated Command Line</span>
          </span>
          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="copyCommand()">
            <i class="bi bi-clipboard"></i>
            <span>Copy Command</span>
          </button>
        </div>

        <!-- Command Code Box -->
        <div class="p-3 rounded-2 bg-dark font-mono text-light mb-3 position-relative border border-secondary border-opacity-50 user-select-all" style="font-size: 1.05rem;">
          <span style="color: var(--dn-accent);">$</span> {{ result.command }}
        </div>

        @if (result.warnings) {
          <div class="alert alert-warning py-2 small d-flex align-items-center gap-2 mb-3">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ result.warnings }}</span>
          </div>
        }

        <!-- Explanation & Step breakdown -->
        <div>
          <h4 class="h6 fw-bold text-light mb-2">Command Explanation</h4>
          <p class="text-secondary small mb-3">{{ result.explanation }}</p>

          <h5 class="small fw-bold text-light mb-2">Step-by-Step Breakdown:</h5>
          <ul class="list-unstyled mb-0">
            @for (step of result.steps; track $index) {
              <li class="small text-secondary d-flex align-items-start gap-2 mb-1.5">
                <i class="bi bi-check2-circle text-success mt-0.5"></i>
                <span>{{ step }}</span>
              </li>
            }
          </ul>
        </div>
      </div>
    </div>
  `
})
export class GitCommandGeneratorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private notifyService = inject(NotificationService);

  public activeOperation = 'branch';
  public gitForm!: FormGroup;
  public result: GeneratedGitResult = {
    command: '',
    explanation: '',
    steps: []
  };

  public operations = [
    { id: 'branch', name: 'Branching', icon: 'bi-git' },
    { id: 'commit', name: 'Commit', icon: 'bi-check2-square' },
    { id: 'rebase', name: 'Rebase & Merge', icon: 'bi-diagram-2' },
    { id: 'reset', name: 'Reset & Undo', icon: 'bi-arrow-counterclockwise' },
    { id: 'stash', name: 'Stash Work', icon: 'bi-archive' }
  ];

  ngOnInit(): void {
    this.initForm();
    this.buildGitCommand();
  }

  private initForm(): void {
    this.gitForm = this.fb.group({
      branchAction: ['create_and_switch'],
      branchName: ['feature/developer-tools'],
      commitType: ['feat'],
      commitMessage: ['add advanced api tester and swagger ui'],
      commitStageAll: [true],
      rebaseType: ['interactive'],
      rebaseCount: [3],
      rebaseTargetBranch: ['main'],
      resetMode: ['soft'],
      resetTarget: ['HEAD~1'],
      stashAction: ['push'],
      stashMessage: ['WIP: temporary stash'],
      stashUntracked: [true]
    });

    this.gitForm.valueChanges.subscribe(() => {
      this.buildGitCommand();
    });
  }

  selectOperation(opId: string): void {
    this.activeOperation = opId;
    this.buildGitCommand();
  }

  buildGitCommand(): void {
    const val = this.gitForm.value;

    switch (this.activeOperation) {
      case 'branch':
        if (val.branchAction === 'create_and_switch') {
          this.result = {
            command: `git switch -c ${val.branchName || 'new-feature'}`,
            explanation: `Creates a brand new branch named '${val.branchName}' from current HEAD and immediately checks it out.`,
            steps: [
              `'switch -c' is the modern Git 2.23+ recommended syntax replacing 'checkout -b'`,
              `Creates the local branch reference`,
              `Switches the working directory to the newly created branch`
            ]
          };
        } else if (val.branchAction === 'switch') {
          this.result = {
            command: `git switch ${val.branchName || 'main'}`,
            explanation: `Switches your working copy to existing branch '${val.branchName}'.`,
            steps: [`Updates working directory files to match target branch HEAD`]
          };
        } else if (val.branchAction === 'rename') {
          this.result = {
            command: `git branch -m ${val.branchName || 'new-name'}`,
            explanation: `Renames current checked out branch to '${val.branchName}'.`,
            steps: [`'-m' moves/renames the branch reference without touching commit history`]
          };
        } else if (val.branchAction === 'delete_local') {
          this.result = {
            command: `git branch -d ${val.branchName || 'old-branch'}`,
            explanation: `Safely deletes local branch '${val.branchName}' only if fully merged. Use -D to force delete.`,
            steps: [`Verifies merge status before deleting local reference`]
          };
        } else {
          this.result = {
            command: `git push origin --delete ${val.branchName || 'old-branch'}`,
            explanation: `Deletes remote branch reference '${val.branchName}' on origin repository.`,
            steps: [`Sends delete signal to remote Git host (GitHub, GitLab, Bitbucket)`]
          };
        }
        break;

      case 'commit':
        const prefix = val.commitType ? `${val.commitType}: ` : '';
        const msg = `${prefix}${val.commitMessage || 'update code'}`;
        const cmd = val.commitStageAll
          ? `git add -A && git commit -m "${msg}"`
          : `git commit -m "${msg}"`;

        this.result = {
          command: cmd,
          explanation: `Stages all untracked, modified, and deleted files and records a conventional commit message.`,
          steps: [
            val.commitStageAll ? `'add -A' stages modified, deleted, and newly added files` : 'Stages current index',
            `'commit -m' records new snapshot with semantic commit message conforming to Conventional Commits`
          ]
        };
        break;

      case 'rebase':
        if (val.rebaseType === 'interactive') {
          this.result = {
            command: `git rebase -i HEAD~${val.rebaseCount || 3}`,
            explanation: `Launches an interactive rebase editor for the last ${val.rebaseCount || 3} commits.`,
            steps: [
              `Allows you to squash (meld), reword, edit, or drop any of the selected commits`,
              `Rewrites local Git history cleanly before pushing a PR`
            ]
          };
        } else if (val.rebaseType === 'onto_branch') {
          this.result = {
            command: `git fetch origin && git rebase origin/${val.rebaseTargetBranch || 'main'}`,
            explanation: `Fetches latest commits from remote and reapplies your local commits on top of origin/${val.rebaseTargetBranch || 'main'}.`,
            steps: [
              `Downloads latest remote references without auto-merging`,
              `Unwinds local commits, updates base to latest origin commits, and reapplies each local commit`
            ]
          };
        } else if (val.rebaseType === 'continue') {
          this.result = {
            command: `git add . && git rebase --continue`,
            explanation: `Marks resolved conflict files and resumes the current rebase sequence.`,
            steps: [`Stages fixed conflicts`, `Continues replaying remaining commits`]
          };
        } else {
          this.result = {
            command: `git rebase --abort`,
            explanation: `Safely cancels in-progress rebase and returns your working branch to its exact pre-rebase state.`,
            steps: [`Restores HEAD and resets working directory cleanly`]
          };
        }
        break;

      case 'reset':
        const mode = val.resetMode;
        const target = val.resetTarget || 'HEAD~1';
        let warn: string | undefined;

        if (mode === 'hard') {
          warn = 'CAUTION: --hard permanently discards all uncommitted file modifications in the working directory!';
        }

        this.result = {
          command: `git reset --${mode} ${target}`,
          explanation: `Moves the HEAD pointer back to ${target} using '${mode}' mode.`,
          warnings: warn,
          steps: [
            mode === 'soft'
              ? 'Keeps all files intact and keeps all changed files in the staging area ready to re-commit'
              : mode === 'mixed'
              ? 'Keeps all files on disk, but removes them from staging index'
              : 'Resets index and destroys all unstaged/uncommitted modifications'
          ]
        };
        break;

      case 'stash':
        if (val.stashAction === 'push') {
          const uFlag = val.stashUntracked ? ' -u' : '';
          const mFlag = val.stashMessage ? ` -m "${val.stashMessage}"` : '';
          this.result = {
            command: `git stash push${uFlag}${mFlag}`,
            explanation: `Saves dirty working directory modifications onto the stash stack and reverts to a clean HEAD.`,
            steps: [
              val.stashUntracked ? `'-u' includes untracked new files in the stash` : 'Stashes tracked modified files only',
              `Provides a clean working tree so you can switch branches or pull updates without conflicts`
            ]
          };
        } else if (val.stashAction === 'pop') {
          this.result = {
            command: `git stash pop`,
            explanation: `Applies the topmost stash entry back to your working copy and removes it from the stash stack.`,
            steps: [`Re-applies stashed changes`, `Removes stash@{0} from list`]
          };
        } else if (val.stashAction === 'list') {
          this.result = {
            command: `git stash list`,
            explanation: `Lists all currently saved stash snapshots and their names/hashes.`,
            steps: [`Outputs list of stash indices (e.g. stash@{0}, stash@{1})`]
          };
        } else {
          this.result = {
            command: `git stash clear`,
            explanation: `Permanently deletes all stashed working directory states.`,
            warnings: 'This action cannot be undone!',
            steps: [`Flushes the entire Git stash stack`]
          };
        }
        break;
    }
  }

  copyCommand(): void {
    if (this.result.command) {
      navigator.clipboard.writeText(this.result.command).then(() => {
        this.notifyService.success('Copied Git command');
      });
    }
  }

  loadSampleData(): void {
    this.activeOperation = 'commit';
    this.gitForm.patchValue({
      commitType: 'feat',
      commitMessage: 'implement reactive forms with angular 20 signals and destroyref',
      commitStageAll: true
    });
    this.buildGitCommand();
    this.notifyService.info('Sample git command loaded');
  }

  resetForm(): void {
    this.gitForm.reset({
      branchAction: 'create_and_switch',
      branchName: 'main',
      commitType: 'feat',
      commitMessage: '',
      commitStageAll: true,
      rebaseType: 'interactive',
      rebaseCount: 3,
      resetMode: 'soft',
      resetTarget: 'HEAD~1',
      stashAction: 'push',
      stashMessage: '',
      stashUntracked: true
    });
    this.buildGitCommand();
  }
}

