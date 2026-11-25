import{a as T}from"./chunk-HD2Y6NN6.js";import{a as S}from"./chunk-G5QJ2RPM.js";import"./chunk-WKI6YRP5.js";import{Cb as r,Eb as m,Ga as n,Ic as v,Mc as _,S as u,Va as f,db as C,eb as g,gc as h,jb as l,kb as i,kc as b,lb as o,mb as d,tb as s,ub as y}from"./chunk-43HTBV5U.js";function B(c,t){if(c&1&&(i(0,"div",9)(1,"span",16),r(2),o(),i(3,"span",17),r(4),o(),i(5,"span",18),r(6),o()()),c&2){let a=y();n(2),m("Original: ",a.originalBytes," B"),n(2),m("Minified: ",a.minifiedBytes," B"),n(2),m("-",a.savingsPercent,"% Saved")}}var M=class c{notifyService=u(_);codeType="javascript";inputCode="";outputCode="";originalBytes=0;minifiedBytes=0;savingsPercent=0;setCodeType(t){this.codeType=t,this.minify()}getFileExtension(){switch(this.codeType){case"javascript":return"js";case"css":return"css";case"html":return"html"}}onInputChange(t){this.inputCode=t,this.minify()}minify(){if(!this.inputCode.trim()){this.outputCode="",this.savingsPercent=0;return}let t="";switch(this.codeType){case"javascript":t=this.minifyJs(this.inputCode);break;case"css":t=this.minifyCss(this.inputCode);break;case"html":t=this.minifyHtml(this.inputCode);break}this.outputCode=t,this.originalBytes=new Blob([this.inputCode]).size,this.minifiedBytes=new Blob([this.outputCode]).size,this.originalBytes>0&&(this.savingsPercent=Math.max(0,Math.round((this.originalBytes-this.minifiedBytes)/this.originalBytes*100)))}minifyJs(t){return t.replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/[^\n]*/g,"$1").replace(/\s+/g," ").replace(/\s*([=+\-*\/%&|^!~?:;,{}()[\]<>])\s*/g,"$1").trim()}minifyCss(t){return t.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\s*([{}:;,>+~])\s*/g,"$1").replace(/\s+/g," ").replace(/;}/g,"}").trim()}minifyHtml(t){return t.replace(/<!--[\s\S]*?-->/g,"").replace(/\s+/g," ").replace(/>\s+</g,"><").trim()}loadSampleData(){this.codeType==="javascript"?this.inputCode=`// DevNexus Utility Module
/* Multi-line documentation block
   calculates fibonacci sequence
*/
function calculateFibonacci(n) {
  // Base cases
  if (n <= 1) {
    return n;
  }

  let prev = 0;
  let curr = 1;

  for (let i = 2; i <= n; i++) {
    let next = prev + curr;
    prev = curr;
    curr = next;
  }

  return curr;
}

console.log(calculateFibonacci(10));`:this.codeType==="css"?this.inputCode=`/* Theme Styles for DevNexus */
.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: #030407;
  border-bottom: 1px solid #1f2738;
}

.brand-title {
  font-family: 'JetBrains Mono', monospace;
  color: #d4ff24;
  font-weight: 700;
  margin: 0;
}`:this.inputCode=`<!DOCTYPE html>
<!-- Page Header -->
<html lang="en">
  <head>
    <title>DevNexus Demo</title>
  </head>
  <body>
    <div class="app-root">
      <h1>Hello Developers!</h1>
      <p>All-in-one productivity suite.</p>
    </div>
  </body>
</html>`,this.minify(),this.notifyService.info("Sample code loaded")}clearAll(){this.inputCode="",this.outputCode="",this.savingsPercent=0}static \u0275fac=function(a){return new(a||c)};static \u0275cmp=f({type:c,selectors:[["app-code-minifier"]],decls:24,vars:15,consts:[[1,"code-minifier-tool","p-3"],["title","Code Minifier (JS / CSS / HTML)","description","Compress JavaScript, CSS stylesheets, and HTML markup by stripping comments and redundant whitespace.","icon","bi-file-zip","toolId","code-minifier",3,"loadSample","clear","showSampleBtn","showCopyBtn","copyContent","showDownloadBtn","downloadContent","downloadFilename"],[1,"dn-card","p-3","mb-3"],[1,"d-flex","flex-wrap","align-items-center","justify-content-between","gap-3"],["role","group",1,"btn-group"],["type","button",1,"btn","btn-sm",3,"click","ngClass"],[1,"bi","bi-filetype-js","me-1"],[1,"bi","bi-filetype-css","me-1"],[1,"bi","bi-filetype-html","me-1"],[1,"d-flex","align-items-center","gap-2","small","font-mono"],["type","button",1,"btn","btn-sm","btn-accent","d-flex","align-items-center","gap-1",3,"click"],[1,"bi","bi-arrows-collapse"],[1,"row","g-3"],[1,"col-lg-6"],["title","Source Code Input","placeholder","Paste code to minify...","height","480px",3,"valueChange","language","value"],["title","Minified Result","placeholder","Minified code will appear here...","height","480px",3,"language","value","readOnly"],[1,"badge","bg-secondary-subtle","text-secondary"],[1,"badge","bg-secondary-subtle","text-info"],[1,"badge","bg-success-subtle","text-success"]],template:function(a,e){a&1&&(i(0,"div",0)(1,"app-tool-header",1),s("loadSample",function(){return e.loadSampleData()})("clear",function(){return e.clearAll()}),o(),i(2,"div",2)(3,"div",3)(4,"div",4)(5,"button",5),s("click",function(){return e.setCodeType("javascript")}),d(6,"i",6),r(7," JavaScript "),o(),i(8,"button",5),s("click",function(){return e.setCodeType("css")}),d(9,"i",7),r(10," CSS "),o(),i(11,"button",5),s("click",function(){return e.setCodeType("html")}),d(12,"i",8),r(13," HTML "),o()(),C(14,B,7,3,"div",9),i(15,"button",10),s("click",function(){return e.minify()}),d(16,"i",11),i(17,"span"),r(18,"Minify Code"),o()()()(),i(19,"div",12)(20,"div",13)(21,"app-code-editor",14),s("valueChange",function(w){return e.onInputChange(w)}),o()(),i(22,"div",13),d(23,"app-code-editor",15),o()()()),a&2&&(n(),l("showSampleBtn",!0)("showCopyBtn",!0)("copyContent",e.outputCode)("showDownloadBtn",!0)("downloadContent",e.outputCode)("downloadFilename","minified."+e.getFileExtension()),n(4),l("ngClass",e.codeType==="javascript"?"btn-accent":"btn-outline-secondary"),n(3),l("ngClass",e.codeType==="css"?"btn-accent":"btn-outline-secondary"),n(3),l("ngClass",e.codeType==="html"?"btn-accent":"btn-outline-secondary"),n(3),g(e.outputCode?14:-1),n(7),l("language",e.codeType)("value",e.inputCode),n(2),l("language",e.codeType)("value",e.outputCode)("readOnly",!0))},dependencies:[b,h,v,S,T],encapsulation:2})};export{M as CodeMinifierComponent};
