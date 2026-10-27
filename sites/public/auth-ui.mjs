export const SIGN_IN_PATH='/signin-with-chatgpt?return_to=%2F';
// Dispatch owns sign-in. A real anchor performs top-level navigation, never fetch.
export function createSignInLink(document,preserveEdits=false){
 const link=document.createElement('a');link.href=SIGN_IN_PATH;link.className='small-button sign-in-link';
 link.textContent=preserveEdits?'Sign in in a new tab':'Sign in with ChatGPT';
 link.target=preserveEdits?'_blank':'_top';
 if(preserveEdits)link.rel='noopener noreferrer';
 return link;
}
