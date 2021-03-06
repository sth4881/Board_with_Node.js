const express = require('express')
const app = express()
const mysql = require('mysql')
const session = require('express-session');
var db = mysql.createConnection({
    host     : 'localhost',
    user     : '****',
    password : '****',
    database : '****'
});
db.connect();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(express.json())
app.use(express.urlencoded({ extended : true }))

// express-session 미들웨어 사용
app.use(session({
    secret: '@#@$MYBOARD#@$#$',
    resave: false,
    saveUninitialized: true
}))

// 글 목록 구현 함수
function list(results) {
    var list = '<ol reversed>'
    for(var i=results.length-1; i>=0; i--) {
        list += `<li><a href="read/${results[i].id}">${results[i].title}</a>,
        ${results[i].name} posted on ${results[i].datetime}</li>`
    }
    list += '</ol>'
    return list;
}
 
// 로그인 or 회원가입 선택
app.get('/', function(req, res) {
    if(!req.session.user) {
        //console.log('세션이 존재하지 않습니다.')
        res.render('index')
    }
    else res.redirect('main')
})

// 회원가입 기능 구현
// JOB을 제외한 항목이 하나라도 비어있으면 가입 불가
// 회원가입하려는 이메일이 이미 존재할 경우 가입 불가
app.get('/signup', function(req, res) {
    res.render('signup')
})
app.post('/signup', function(req, res) {
    var sql1 = 'SELECT * from user WHERE email=?'
    var sql2 = 'INSERT INTO user(email, password, name, job) VALUES(?, ?, ?, ?)'
    
    // 이메일, 비밀번호, 이름 중에서 하나의 항목이라도 비어있으면 오류 발생
    if(req.body.email=='' || req.body.password=='' || req.body.name=='')
        res.send('2')
    else {
        db.query(sql1, [req.body.email], function(error, info) {
            // 해당 이메일이 회원으로 등록되어있지 않을 경우 실행
            if(info[0]==undefined) {
                db.query(sql2, [req.body.email, req.body.password, req.body.name, req.body.job], 
                    function(error) {
                        if(error) throw error
                        else res.send('1')
                    }
                )
            } 
            // 해당 이메일이 이미 회원으로 등록되어 있을 경우
            else if(req.body.email==info[0].email) {
                res.send('3')
            }
        })
    }
})

// 로그아웃 기능 구현
app.get('/logout', function(req, res) {
    req.session.destroy(function(error) {
        console.log('세션을 종료합니다.')
        res.redirect('/')
    })
})

// 로그인 기능 구현
// login.ejs로부터 받은 'password' 값과
// DB에 저장된 'password' 값이 일치하면 성공
app.get('/login', function(req, res) {
    if(!req.session.user) {
        console.log('세션이 존재하지 않습니다.')
        res.render('login')
    }
    else res.redirect('main')
})
app.post('/login', function(req, res) {
    // 입력 데이터랑 mysql 데이터랑 비교해서
    // 일치하면 로그인해서 main.ejs로 보내기
    var sql = "SELECT * FROM user WHERE email=?"
    // 이메일 or 비밀번호 칸이 하나라도 비어있을 경우
    if (req.body.email=='' || req.body.password=='')
        res.send('2')
    else {
        db.query(sql, [req.body.email, req.body.password], function(error, results) {
            if (error) throw error
            else if(results[0]==undefined) // 회원정보가 존재하지 않을 경우
                res.send('3')
            else if (results[0].password==req.body.password) {
                // 세션이 없을 경우 생성
                if(!req.session.user) {
                    req.session.user = {
                        email : results[0].email,
                        name : results[0].name,
                        job : results[0].job
                    }
                }
                console.log(req.session)
                res.send('1')
            }
            else res.send('2') // 이메일은 일치하지만 비밀번호가 다른 경우
        })
    }
})

// 글 목록 구현(main에서 가능)
app.get('/main', function(req, res) {
    // 로그인되어있지 않으면 로그인 요청 알림 띄우고 loginFirst.ejs로 이동
    // (!)loginFirst.ejs는 alert와 redirection이 동시에 발생하는 빈 페이지
    if(!req.session.user) {
        res.render('loginFirst')
    } else {
        // 글 목록 표시
        var sql = `SELECT a.id, title, name, DATE_FORMAT(modified, '%Y-%m-%d %H:%i:%s')
                    AS datetime FROM article a JOIN user u on a.author_id=u.id`
        db.query(sql, function(error, results) {
            if (error) throw error
            res.render('main', {name : 'temp', list : list(results)})
        })
    }
})

// 글 내용 조회 기능 구현(해당 페이지에서 글 수정 & 삭제 표시)
app.get('/read/:id', function(req, res) {
    if(!req.session.user) {
        res.render('loginFirst')
    } else {
        // 해당 페이지에 표시할 글의 정보를 알기 위한 sql
        var sql = `SELECT a.id, email, name, title, contents, DATE_FORMAT(modified, '%Y-%m-%d %H:%i:%s')
                    AS datetime FROM article a JOIN user u WHERE a.author_id=u.id AND a.id=?`
        // req.params.id는 a.id가 아닌 'read/:id'의 id를 말함
        db.query(sql, [req.params.id], function(error, results) {
            if (error) throw error
            // :id가 있는 페이지는 앞의 view를 이용해서 구현(DB의 id값을 불러와서 연결하는 방식)
            // 현재 접속중인 사용자의 이메일과 저자의 이메일이 일치할 경우 수정 & 삭제 버튼 표시
            if(req.session.user.email==results[0].email) {
                res.render('read', {title : results[0].title, contents : results[0].contents, author : results[0].name, 
                    authorized : `
                        <input type="button" id="modify" name="modify" value="글 수정">
                        <input type="button" id="delete" name="delete" value="글 삭제">
                    `
                })
            } else {
                res.render('read', {title : results[0].title, contents : results[0].contents, author : results[0].name, authorized : ''})
            }
        })
    }
})
// 글 삭제 기능 구현(중)
app.post('/read/:id', function(req, res) {
    if(req.body.confirm=='true') {
        console.log(req.params)
        /*
        var sql = 'DELETE FROM article WHERE id=?'
        db.query(sql, [req.params.id], function(error, result) {
            if(error) throw error;
            res.send('삭제')
        })
        */
    }
})

// 글 쓰기 기능 구현(main에서 가능)
app.get('/write', function(req, res) {
    if(!req.session.user) {
        res.render('loginFirst')
    } else res.render('write')
})
app.post('/write', function(req, res) {
    var userEmail = req.session.user.email
    var sql1 = 'SELECT * FROM user WHERE email=?'
    var sql2 = `INSERT INTO article(title, contents, author_id, 
        created, modified) VALUES(?, ?, ?, NOW(), NOW())`
    console.log(req.body)
    db.query(sql1, [userEmail], function(error, author) {
        if(error) throw error
        else {
            db.query(sql2, [req.body.title, req.body.contents, author[0].id], 
                function(error) {
                    if(error) throw error
                    res.send('1')
                }
            )
        }
    })
})

// 글 수정 기능 구현(해당 글에서 가능, 제목과 내용만)
app.get('/modify', function(req, res) {
    res.render('modify')
})
app.post('/modify', function(req, res) {

})

app.listen(3000, console.log('App listening at http://localhost:3000'))