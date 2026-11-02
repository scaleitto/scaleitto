import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanRichText, descriptionHtml, richTextFromPlain, richTextToPlain } from "../../src/lib/rich-text";

test("rich text keeps the editor's formatting and drops everything else", () => {
  assert.equal(cleanRichText("<p><b>Gras</b> et <i>italique</i>, <u>souligné</u> <strike>barré</strike></p>"), "<p><strong>Gras</strong> et <em>italique</em>, <u>souligné</u> <s>barré</s></p>");
  assert.equal(cleanRichText('<h2 style="text-align: center; color: red">Titre</h2><ul><li>Un</li></ul>'), '<h2 style="text-align:center">Titre</h2><ul><li>Un</li></ul>');
  assert.equal(cleanRichText("<div>ligne<br>deux</div>"), "<p>ligne<br>deux</p>");
  assert.equal(cleanRichText('<p onclick="x()">a<script>alert(1)</script><img src=x onerror=alert(1)>b</p>'), "<p>ab</p>");
  assert.equal(cleanRichText('<a href="javascript:alert(1)">x</a><a href="https://e.dz">y</a>'), '<p>x<a href="https://e.dz" target="_blank" rel="noopener noreferrer nofollow">y</a></p>');
  assert.equal(cleanRichText("<p>1 < 2 & 3</p>"), "<p>1 &lt; 2 &amp; 3</p>");
  assert.equal(cleanRichText("<p><strong>non fermé"), "<p><strong>non fermé</strong></p>");
  assert.equal(cleanRichText("<style>p{}</style><p><span>texte</span></p>"), "<p>texte</p>");
});

test("plain descriptions become paragraphs and lists; rich text back to words", () => {
  assert.equal(richTextFromPlain("Montre élégante\n\n• étanche\n• légère"), "<p>Montre élégante</p><ul><li>étanche</li><li>légère</li></ul>");
  assert.equal(richTextFromPlain("a\nb"), "<p>a<br>b</p>");
  assert.equal(descriptionHtml("<p>déjà</p>"), "<p>déjà</p>");
  assert.equal(descriptionHtml("texte <b>"), "<p>texte <strong></strong></p>");
  assert.equal(richTextToPlain("<h2>Titre</h2><ul><li>Un</li><li>Deux &amp; trois</li></ul>"), "Titre\n• Un\n• Deux & trois");
});
