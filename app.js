const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));
app.set('port', (process.env.PORT || 5000));

var config = require('./apikey');
var db_config = {
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database
};

/****************************ここから****************************/
/*https://ninna2.hatenablog.com/entry/2017/02/22/node-mysql%E3%81%A7%E6%8E%A5%E7%B6%9A%E3%81%8C%E5%88%87%E3%82%8C%E3%82%8B%E7%82%B9%E3%82%92%E6%94%B9%E5%96%84*/

var pool = mysql.createPool(db_config);

/****************************ここまで****************************/

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'my_secret_key',
    resave: false,
    saveUninitialized: false,
  })
);

app.use((req, res, next) => {
  if (req.session.userId === undefined) {
    res.locals.username = 'ゲスト';
    res.locals.isLoggedIn = false;
  } else {
    res.locals.username = req.session.username;
    res.locals.isLoggedIn = true;
  }
  next();
});

console.log('handleSisconnectをこれから行います（６６）');

app.get('/', (req, res) => {
  res.render('top.ejs');
});

app.get('/index', (req, res) => {
  pool.getConnection(function(err, connection){
    connection.query(
      'SELECT * FROM atcoder_list',
      (error, results) => {
        res.render('index.ejs', {atcoder_list: results});
        connection.release();
      }
    );
  });
});

app.get('/signup', (req, res) => {
  res.render('signup.ejs', {errors: []});
})

app.post('/signup', (req, res, next) => {
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const errors = [];

  if (username === '') {
    errors.push('ユーザー名を入力してください。');
  }

  if (email === '') {
    errors.push('メールアドレスを入力してください。');
  }

  if (email.indexOf('@') === -1) {
    errors.push('メールアドレスに @ が含まれていません。');
  }

  if (password === '') {
    errors.push('パスワードを入力してください。');
  }

  if (errors.length > 0) {
    res.render('signup.ejs', {errors: errors});
  } else {
    next();
  }
},
(req, res, next) => {
  console.log('ユーザー名の重複チェック');
  const username = req.body.username;
  const errors = [];

  console.log(username + 'さんが新規登録しようとしています。');
  pool.getConnection(function(err, connection){
    connection.query(
      'SELECT * FROM users WHERE username = ?',
      [username],
      (error, results) => {
        console.log("新規登録のresultsの中身見るためのデバッグ -> " + results);
        if (results.length > 0) {
          errors.push('このユーザー名は既に使用されています。');
          res.render('signup.ejs', { errors: errors });
        } else {
          next();
        }
        connection.release();
      }
    );
  });
},
(req, res) => {
  console.log('ユーザー登録');
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;

  bcrypt.hash(password, 10, (error, hash) => {
    pool.getConnection(function(err, connection) {
      connection.query(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hash],
        (error, results) => {
          req.session.userId = results.insertId;
          req.session.username = username;
          res.redirect('/index');
          connection.release();
        }
      );
    });
  });
}
);

app.get('/new', (req, res) => {
  res.render('new.ejs');
});

app.post('/create', (req, res) => {
  const new_problem = req.body.NewProblem;
  const new_problem_url = req.body.NewProblemUrl;
  const new_problem_genre = req.body.ProblemGenre;
  const new_problem_status = req.body.NewProblemStatus;
  let new_problem_difficulty = req.body.NewProblemDifficulty;
  const username = res.locals.username;
  let new_problem_status_color = 'rgb(241, 171, 85);';

  if (new_problem_difficulty == '未設定') {
    new_problem_difficulty = 'rgb(0, 0, 0, 0.7);';
  } else if (new_problem_difficulty == '灰') {
    new_problem_difficulty = 'rgb(128, 128, 128, 0.7);';
  } else if (new_problem_difficulty == '茶') {
    new_problem_difficulty = 'rgb(129, 62, 8, 0.7);';
  } else if (new_problem_difficulty == '緑') {
    new_problem_difficulty = 'rgb(16, 126, 25, 0.7);';
  } else if (new_problem_difficulty == '水') {
    new_problem_difficulty = 'rgb(0, 192, 192, 0.7);';
  } else if (new_problem_difficulty == '青') {
    new_problem_difficulty = 'rgb(0, 48, 250, 0.7);';
  } else if (new_problem_difficulty == '黄') {
    new_problem_difficulty = 'rgb(194, 189, 41, 0.7);';
  } else if (new_problem_difficulty == '橙') {
    new_problem_difficulty = 'rgb(255, 126, 25, 0.7);';
  } else if (new_problem_difficulty == '赤') {
    new_problem_difficulty = 'rgb(255, 0, 0, 0.7);';
  }

  if (new_problem_status == 'AC') {
    new_problem_status_color = 'rgb(96, 182, 98);';
  }

  if (new_problem_status == '未提出') {
    new_problem_status_color = 'rgb(255, 164, 255, 0.7);';
  }

  pool.getConnection(function(err, connection) {
    connection.query(
      'INSERT INTO atcoder_list (problem_name, problem_url, problem_genre, problem_status, problem_status_color, problem_difficulty, username) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [new_problem, new_problem_url, new_problem_genre, new_problem_status, new_problem_status_color, new_problem_difficulty, username],
      (error, results) => {
        console.log(username + 'さんが問題を作成しました。');
        res.redirect('/index');
        connection.release();
      }
    );
  });
});

app.post('/delete/:id', (req, res) => {
  let delete_id = req.params.id;
  pool.getConnection(function(err, connection) {
    connection.query(
      'DELETE FROM atcoder_list WHERE id = ?',
      [delete_id],
      (error, results) => {
        res.redirect('/index');
      }
    );
  });
});

app.get('/edit/:id', (req, res) => {
  pool.getConnection(function(err, connection) {
    connection.query(
      'SELECT * FROM atcoder_list WHERE id = ?',
      [req.params.id],
      (error, results) => {
        res.render('edit.ejs', {item: results[0]});
      }
    );
  });
});

app.post('/update/:id', (req, res,) => {
  const edit_problem = req.body.EditProblem;
  const edit_problem_url = req.body.EditProblemUrl;
  const edit_problem_genre = req.body.EditProblemGenre;
  const edit_problem_status = req.body.EditProblemStatus;
  let edit_problem_difficulty = req.body.EditProblemDifficulty;
  let edit_problem_status_color = 'rgb(241, 171, 85);';

  if (edit_problem_difficulty == '未設定') {
    edit_problem_difficulty = 'rgb(0, 0, 0, 0.7);';
  } else if (edit_problem_difficulty == '灰') {
    edit_problem_difficulty = 'rgb(128, 128, 128, 0.7);';
  } else if (edit_problem_difficulty == '茶') {
    edit_problem_difficulty = 'rgb(129, 62, 8, 0.7);';
  } else if (edit_problem_difficulty == '緑') {
    edit_problem_difficulty = 'rgb(16, 126, 25, 0.7);';
  } else if (edit_problem_difficulty == '水') {
    edit_problem_difficulty = 'rgb(0, 192, 192, 0.7);';
  } else if (edit_problem_difficulty == '青') {
    edit_problem_difficulty = 'rgb(0, 48, 250, 0.7);';
  } else if (edit_problem_difficulty == '黄') {
    edit_problem_difficulty = 'rgb(194, 189, 41, 0.7);';
  } else if (edit_problem_difficulty == '橙') {
    edit_problem_difficulty = 'rgb(255, 126, 25, 0.7);';
  } else if (edit_problem_difficulty == '赤') {
    edit_problem_difficulty = 'rgb(255, 0, 0, 0.7);';
  }

  if (edit_problem_status == 'AC') {
    edit_problem_status_color = 'rgb(96, 182, 98);';
  }

  if (edit_problem_status == '未提出') {
    edit_problem_status_color = 'rgb(255, 164, 255, 0.7);';
  }

  if (edit_problem_genre == null) {
    pool.getConnection(function(err, connection) {
      connection.query(
        'UPDATE atcoder_list SET problem_name = ?, problem_url = ?, problem_status = ?, problem_status_color = ?, problem_difficulty = ? WHERE id = ?',
        [edit_problem, edit_problem_url, edit_problem_status, edit_problem_status_color, edit_problem_difficulty, req.params.id],
        (error, results) => {
          res.redirect('/index');
        }
      );
    });
  } else {
    pool.getConnection(function(err, connection) {
      connection.query(
        'UPDATE atcoder_list SET problem_name = ?, problem_url = ?, problem_genre = ?, problem_status = ?, problem_status_color = ?, problem_difficulty = ? WHERE id = ?',
        [edit_problem, edit_problem_url, edit_problem_genre, edit_problem_status, edit_problem_status_color, edit_problem_difficulty, req.params.id],
        (error, results) => {
          res.redirect('/index');
        }
      );
    });
  }
});

app.get('/login', (req, res) => {
  res.render('login.ejs', {errors: []});
})

app.post('/login', (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  const errors = [];

  if (username === '') {
    errors.push('ユーザー名を入力してください。');
  }

  if (password === '') {
    errors.push('パスワードを入力してください。');
  }

  if (errors.length > 0) {
    console.log(username + 'さんがログインに失敗し、弾かれました。');
    res.render('login.ejs', {errors: errors});
  } else {
    next();
  }
},
(req, res) => {
  const username = req.body.username;
  console.log(username + 'さんがログインしました！');
  pool.getConnection(function(err, connection) {
    connection.query(
      'SELECT * FROM users WHERE username = ?',
      [username],
      (error, results) => {
        if (results.length > 0) {
          const plain = req.body.password;
          const hash = results[0].password;
          bcrypt.compare(plain, hash, (error, isEqual) => {
            if (isEqual) {
              req.session.userId = results[0].id;
              req.session.username = results[0].username;
              res.redirect('/index');
            } else {
              const errors = [];
              errors.push('ユーザー名もしくはパスワードが間違っています。');
              res.render('login.ejs', {errors: errors});
            }
          });
        } else {
          const errors = [];
          errors.push('ユーザー名が登録されていません。');
          res.render('login.ejs', {errors: errors});
        }
      connection.release();
      }
    );
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(error => {
    res.redirect('/index');
  });
});

app.listen(app.get('port'), function() {
  console.log('heroku-mysql app is running on port', app.get('port'));
});