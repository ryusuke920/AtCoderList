import { useEffect, type ReactNode } from "react";

const SECTIONS = [
  { id: "about", title: "AtCoder List でできること" },
  { id: "signup", title: "1. アカウントを作る" },
  { id: "atcoder-id", title: "2. AtCoder ID を設定する" },
  { id: "add", title: "3. 問題を追加する" },
  { id: "list", title: "4. 一覧の見かた" },
  { id: "status", title: "5. 状態（AC / WA など）の自動更新" },
  { id: "mobile", title: "6. スマホで使う" },
  { id: "recover", title: "7. パスワードを忘れたとき" },
  { id: "faq", title: "よくある質問" },
];

function Shot({ src, alt, caption, narrow }: { src: string; alt: string; caption?: string; narrow?: boolean }) {
  return (
    <figure className={narrow ? "guide-shot guide-shot-narrow" : "guide-shot"}>
      {/* スマホでは小さいので、押すと原寸で開く */}
      <a href={src} target="_blank" rel="noreferrer">
        <img src={src} alt={alt} loading="lazy" />
      </a>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function Section({ id, children }: { id: string; children: ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section id={id} className="guide-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Guide() {
  // 描画前にブラウザがアンカーへ飛ぼうとして失敗するので、描画後に #見出し へスクロールし直す
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <article className="guide">
      <header className="guide-head">
        <p className="landing-sub">使い方</p>
        <h1>AtCoder List の使い方</h1>
        <p className="guide-lead">
          解きたい問題・復習したい問題を、コンテストから選ぶだけでストックできるツールです。はじめて使うときは、上から順に読んでみてください。
        </p>
        <nav className="guide-toc" aria-label="目次">
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <Section id="about">
        <ul>
          <li>
            <strong>コンテスト名を打って問題を選ぶだけ</strong>で、URL・問題名・配点が入ります（ABC / ARC / AGC / AHC / 企業コンなど、AtCoder の過去のコンテストすべて）
          </li>
          <li>
            <strong>AtCoder ID を登録しておくと、状態（AC / WA / 未提出 など）が自分の提出結果から自動で入ります</strong>。手で更新する必要はありません
          </li>
          <li>Difficulty の色・アルゴリズムのタグ・メモで整理して、あとから検索・絞り込み・並び替えできます</li>
        </ul>
      </Section>

      <Section id="signup">
        <p>
          トップページの「<strong>新規登録</strong>」で、このアプリ用のユーザー名とパスワードを決めます。
          <strong>AtCoder のアカウントやパスワードとは別のものです</strong>（AtCoder のパスワードを入力する場面はありません）。メールアドレスも使いません。
        </p>
        <Shot src="/guide/signup.webp" alt="新規登録のフォーム" caption="ユーザー名は 3〜20 文字、パスワードは 8 文字以上" narrow />
        <p>
          登録すると「<strong>復旧コード</strong>」が一度だけ表示されます。パスワードを忘れたときに必要になるので、
          <strong>パスワード管理アプリやメモに必ず保存</strong>してください。「控えました」にチェックすると先に進めます。
        </p>
        <Shot src="/guide/recovery.webp" alt="復旧コードの表示" caption="復旧コードはこの画面でしか見られません（なくしたら設定画面から再発行できます）" />
      </Section>

      <Section id="atcoder-id">
        <p>
          右上の「<strong>設定</strong>」を開き、「AtCoder ID」に<strong>AtCoder のユーザー名</strong>を入れて「保存」を押します。
          これで、登録した問題の状態が提出結果から自動で入るようになります。
        </p>
        <Shot src="/guide/settings.webp" alt="設定画面" caption="設定画面。AtCoder ID・復旧コード・アカウントの削除がまとまっています" />
        <p className="guide-note">
          AtCoder ID を設定しないと、状態はすべて「未提出」のままです。
        </p>
      </Section>

      <Section id="add">
        <h3>コンテストを探す</h3>
        <p>
          一覧の右上「<strong>＋ 問題を追加</strong>」を押し、「AtCoder から入力」にコンテスト名や ID を打ちます。
          <code>abc47</code> のような ID の一部のほか、<code>企業</code>・<code>UNICORN</code> のようにコンテスト名の一部でも探せます。
          候補を ↑↓ キーと Enter、またはクリックで選びます。
        </p>
        <Shot src="/guide/add-search.webp" alt="コンテストの候補が出ている様子" caption="打つと近いコンテストが新しい順に出てきます" />

        <h3>問題を選ぶ</h3>
        <p>
          コンテストを選ぶと A・B・C… のボタンが並びます。追加したい問題を押すと、<strong>URL・問題名・配点が自動で入ります</strong>。
          あとは Difficulty（色）を選んで「追加する」を押すだけです。
        </p>
        <Shot src="/guide/add-filled.webp" alt="問題を選んで入力された追加フォーム" caption="D を押すと、URL・問題名・配点が入った状態" />
        <p className="guide-note">
          状態は選べません。追加した直後に、あなたの最新の提出結果から自動で入ります。
          Difficulty は AtCoder 公式の値ではないため、自分の感覚や AtCoder Problems の色を見て選んでください。
        </p>

        <h3>アルゴリズムのタグを付ける</h3>
        <p>
          「アルゴリズム」の欄にキーワードを打つと、タグが絞り込まれます。<code>セグ木</code>・<code>BIT</code>・<code>UF</code>・<code>BFS</code>{" "}
          のような略し方でも見つかり、<strong>Enter でいちばん近いタグを付け外し</strong>できます。付けたタグは上に並び、✕ で外せます。
        </p>
        <Shot src="/guide/tags.webp" alt="タグの絞り込み" caption="「セグ木」で Segment Tree が見つかる" />
        <p>メモ欄には、解法の方針や詰まったポイントなどを自由に書けます。</p>
      </Section>

      <Section id="list">
        <Shot src="/guide/list.webp" alt="問題一覧" />
        <dl className="guide-dl">
          <dt>Diff の丸</dt>
          <dd>選んだ Difficulty の色。一覧の上の色の帯は、登録した問題の色の割合です</dd>
          <dt>問題名</dt>
          <dd>押すと AtCoder の問題ページが新しいタブで開きます。メモがあれば下に 2 行まで表示され、押すと全文が見られます</dd>
          <dt>タグ</dt>
          <dd>押すと、そのタグの問題だけに絞り込みます</dd>
          <dt>状態</dt>
          <dd>提出結果から自動で入ります（下の「5.」を参照）</dd>
          <dt>鉛筆 / ゴミ箱</dt>
          <dd>編集 / 削除。編集では問題名・Difficulty・配点・タグ・メモを直せます</dd>
          <dt>検索・絞り込み</dt>
          <dd>問題名とメモの検索、状態・Diff・タグでの絞り込みができます</dd>
          <dt>並び替え</dt>
          <dd>表の見出し（Diff・問題・配点・状態・更新日）を押すと並び替え、もう一度押すと逆順になります</dd>
        </dl>
      </Section>

      <Section id="status">
        <ul>
          <li>
            一度でも AC していれば <strong>AC</strong>、まだなら<strong>最後の提出の結果</strong>（WA / TLE / MLE / RE / CE）、提出がなければ
            <strong>未提出</strong>になります
          </li>
          <li>更新されるのは、問題を追加したとき・問題一覧を開いたとき（10 分に 1 回まで）・一覧の「↻ 同期」を押したときです</li>
          <li>
            提出データは非公式の{" "}
            <a href="https://github.com/kenkoooo/AtCoderProblems" target="_blank" rel="noreferrer">
              AtCoder Problems
            </a>{" "}
            から取得しています。AtCoder で提出してから反映されるまで<strong>数分</strong>（コンテスト直後は数時間）かかることがあります
          </li>
        </ul>
      </Section>

      <Section id="mobile">
        <p>
          スマホでは、1 問を 2 行で表示します（1 行目: 問題名と編集・削除、2 行目: 配点・タグ・状態）。並び替えは、絞り込みの下の欄から選びます。
          ブラウザの「ホーム画面に追加」をしておくと、アプリのように開けます。
        </p>
        <Shot src="/guide/mobile.webp" alt="スマホでの表示" narrow />
      </Section>

      <Section id="recover">
        <p>
          ログイン画面の「<strong>パスワードを忘れた</strong>」を押し、ユーザー名・控えておいた復旧コード・新しいパスワードを入力します。
          再設定すると、<strong>使った復旧コードは無効になり、新しいコードが表示される</strong>ので、保存し直してください。
        </p>
        <Shot src="/guide/recover.webp" alt="パスワードの再設定フォーム" narrow />
        <p className="guide-note">
          復旧コードもなくしてしまうと、パスワードを再設定できません。ログインしているうちに、設定画面から再発行しておきましょう。
        </p>
      </Section>

      <Section id="faq">
        <dl className="guide-dl guide-faq">
          <dt>AC したのに状態が変わらない</dt>
          <dd>
            反映まで数分かかることがあります。少し待ってから一覧の「↻ 同期」を押してください。設定画面の AtCoder ID が正しいかも確認してください
          </dd>
          <dt>コンテストが候補に出てこない</dt>
          <dd>
            新しいコンテストは毎朝まとめて取り込んでいるため、開催当日は出てこないことがあります。そのときは URL と問題名を直接入力しても追加できます
          </dd>
          <dt>状態を手で変えたい</dt>
          <dd>状態は提出結果と食い違わないよう、自動でのみ決まります。Difficulty・タグ・メモは自由に編集できます</dd>
          <dt>パスワードを何度か間違えて「しばらく時間をおいて」と出た</dt>
          <dd>5 回続けて間違えると 15 分ロックされます。パスワードを忘れた場合は、ロック中でも復旧コードで再設定できます</dd>
          <dt>アカウントを消したい</dt>
          <dd>設定画面の「アカウントの削除」から削除できます。登録した問題などもすべて消え、元に戻せません</dd>
        </dl>
      </Section>

      <p className="guide-back">
        <a href="/" className="btn btn-primary">
          AtCoder List をはじめる
        </a>
      </p>
    </article>
  );
}
