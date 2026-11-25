import{a as P}from"./chunk-O4XIFU2P.js";import{a as M}from"./chunk-HD2Y6NN6.js";import{a as E}from"./chunk-G5QJ2RPM.js";import"./chunk-WKI6YRP5.js";import{Cb as o,Cc as w,Dc as b,Ec as y,Ga as a,Gb as g,Hb as h,Ib as C,Ic as D,Mc as T,S as f,Va as u,jb as d,kb as t,kc as v,lb as i,mb as m,sc as S,tb as r,uc as _}from"./chunk-43HTBV5U.js";var L=class c{notifyService=f(T);selectedLanguage="typescript";leftCode="";rightCode="";diffPatch="";swapInputs(){let s=this.leftCode;this.leftCode=this.rightCode,this.rightCode=s,this.updatePatch(),this.notifyService.info("Swapped code panes")}updatePatch(){this.diffPatch=`--- original
+++ modified
${this.leftCode}
${this.rightCode}`}loadSampleData(){this.selectedLanguage="typescript",this.leftCode=`import { Component } from '@angular/core';

@Component({
  selector: 'app-user',
  template: '<h1>Hello {{ name }}</h1>'
})
export class UserComponent {
  name: string = 'Developer';

  calculateTotal(items: number[]): number {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += items[i];
    }
    return total;
  }
}`,this.rightCode=`import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-user',
  standalone: true,
  template: '<h1>Hello {{ name() }}</h1>'
})
export class UserComponent {
  readonly name = signal<string>('Lead Engineer');
  readonly items = signal<number[]>([10, 20, 30]);

  readonly total = computed(() => {
    return this.items().reduce((acc, curr) => acc + curr, 0);
  });
}`,this.updatePatch(),this.notifyService.info("Sample code diff loaded")}clearAll(){this.leftCode="",this.rightCode="",this.diffPatch=""}static \u0275fac=function(p){return new(p||c)};static \u0275cmp=u({type:c,selectors:[["app-code-diff"]],decls:33,vars:10,consts:[[1,"code-diff-tool","p-3"],["title","Code Diff Viewer","description","Inspect differences between two source files with unified and side-by-side split comparison views.","icon","bi-layout-split","toolId","code-diff","downloadFilename","changes.patch",3,"loadSample","clear","showSampleBtn","showDownloadBtn","downloadContent"],[1,"dn-card","p-3","mb-3"],[1,"d-flex","flex-wrap","align-items-center","justify-content-between","gap-3"],[1,"d-flex","align-items-center","gap-2"],[1,"small","text-secondary","mb-0"],[1,"form-select","form-select-sm","w-auto","bg-dark-subtle","border-secondary","border-opacity-50","text-light",3,"ngModelChange","ngModel"],["value","typescript"],["value","javascript"],["value","html"],["value","css"],["value","json"],["value","sql"],["value","text"],["type","button","title","Swap left and right code",1,"btn","btn-sm","btn-outline-secondary",3,"click"],[1,"bi","bi-arrow-left-right","me-1"],[1,"mb-4"],["oldTitle","Original Code","newTitle","Modified Code","viewMode","split",3,"oldText","newText"],[1,"row","g-3"],[1,"col-lg-6"],["title","Original Code","placeholder","Paste original source code...","height","340px",3,"valueChange","language","value"],["title","Modified Code","placeholder","Paste modified source code...","height","340px",3,"valueChange","language","value"]],template:function(p,e){p&1&&(t(0,"div",0)(1,"app-tool-header",1),r("loadSample",function(){return e.loadSampleData()})("clear",function(){return e.clearAll()}),i(),t(2,"div",2)(3,"div",3)(4,"div",4)(5,"label",5),o(6,"Language:"),i(),t(7,"select",6),C("ngModelChange",function(n){return h(e.selectedLanguage,n)||(e.selectedLanguage=n),n}),t(8,"option",7),o(9,"TypeScript"),i(),t(10,"option",8),o(11,"JavaScript"),i(),t(12,"option",9),o(13,"HTML"),i(),t(14,"option",10),o(15,"CSS / SCSS"),i(),t(16,"option",11),o(17,"JSON"),i(),t(18,"option",12),o(19,"SQL"),i(),t(20,"option",13),o(21,"Plain Text"),i()()(),t(22,"div",4)(23,"button",14),r("click",function(){return e.swapInputs()}),m(24,"i",15),o(25," Swap "),i()()()(),t(26,"div",16),m(27,"app-diff-viewer",17),i(),t(28,"div",18)(29,"div",19)(30,"app-code-editor",20),r("valueChange",function(n){return e.leftCode=n,e.updatePatch()}),i()(),t(31,"div",19)(32,"app-code-editor",21),r("valueChange",function(n){return e.rightCode=n,e.updatePatch()}),i()()()()),p&2&&(a(),d("showSampleBtn",!0)("showDownloadBtn",!0)("downloadContent",e.diffPatch),a(6),g("ngModel",e.selectedLanguage),a(20),d("oldText",e.leftCode)("newText",e.rightCode),a(3),d("language",e.selectedLanguage)("value",e.leftCode),a(2),d("language",e.selectedLanguage)("value",e.rightCode))},dependencies:[v,D,b,y,w,S,_,E,M,P],encapsulation:2})};export{L as CodeDiffComponent};
