/**
 * Author: yangyang
 * Create Date: 2018-3-1
 * Description: 一键打包部署
 */
module.exports = function() {
    'use strict';
    const
        O = 'app-xj', //项目所在服务器文件夹名
        Q = require('q'),//处理一些异步函数的回调，是node的第三方模块；
        argv = process.argv,// 可能是node main publish test；目前推测argv 获取的是在命令行输入的指令；
        del = require('del'),//del删除文件夹与gulp配合使用；
        gulp = require('gulp'),//引入gulp；
        zip = require('gulp-zip'),//引入zip压缩文件；
        node_ssh = require('node-ssh'),//连接到服务器；node的模块；使用ssh工具连接远程的云主机部署运行web应用；
        colors = require('colors/safe'),//v在你的 node.js 控制台中获取颜色；
        dateFormat = require('dateformat'),//node模块，日期字符串格式化，能获取我们想要的任意格式日期；
        imagemin = require('gulp-imagemin'),//gulp中的压缩图片；
        exec = require('child_process').exec,//创建子进程；
        pngquant = require('imagemin-pngquant'),//gulp中的压缩png图片，压缩jpg图片不是很明显；
        //发布正式和测试的的本地ip地址配置；
        IPs = [{
            host: '123.56.29.106',//中控机的ip；所有的项目都要上传到中控机上；
            post: 22,
            user: 'root',
            dist: '/root',
            privateKey: '/Users/saotx-yyj/.ssh/id_rsa'
        }],
        //发布正式测试的服务器的ip地址配置；
        SERVER = {
            'dev153': {
                type: 'dev',
                host: '172.17.15.153',
                port: 22,
                user: '',
                dist: '/opt/webapps/t-pages',
                privateKey: ''
            },
            'dev189': {
                type: 'dev',
                host: '172.17.15.189',
                port: 22,
                user: '',
                dist: '/opt/webapps/t-pages',
                privateKey: ''
            },
            'test': {
                type: 'test',
                host: '172.17.15.174',
                port: 22,
                user: '',
                dist: '/opt/webapps/t-pages',
                privateKey: ''
            }
        },
        center = new node_ssh(),//使用node_ssh必须先实例化；
        //zipfile = app-xj-2018-13-51-55-01.zip
        zipfile = O + '-' + dateFormat(new Date(), "yyyy-mm-dd-HH-MM-ss") + '.zip';
    //argv：拿到的是命令行的输入命令，只用判断后两个publish，test(dev153,dev189);
    // 判断指令是否正确
    if ('publish' !== argv[2]) {
        process.stdout.write(colors.red('-main: ' + argv[2] + ': command not found\n'));
        process.stdout.write(colors.green('Did you mean "publish" ?\n'));
        return;
    }
    // 判断是否有目标Server
    //如果没有Server，服务器Server是必须的；
    if (!SERVER[argv[3]]) {
        process.stdout.write(colors.green('\x20SERVER REQUIRED!\n'));
        process.stdout.write(colors.blue('\x20-node main pusblish dev\n'));
        process.stdout.write(colors.blue('\x20-node main pusblish test\n'));
        return;
    }

    // 添加目标地址
    //在Ips数组中添加需要发布到测试或者是发布到正式的服务器的一些配置信息；
    IPs.push(SERVER[argv[3]]);

    // 删除打包文件
    var firstStep = function() {
        var defered = Q.defer();
        process.stdout.write(colors.green('ON STEPS: \n'));
        process.stdout.write(colors.green('1、: del -> \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 del dist...\n'));
        //删除打包文件；
        del(['dist'], { force: true }, function(error, stdout, stderr) {
            process.stdout.write(colors.green('\x20\x20\x20 success\n'));
            defered.resolve(true);
        });
        return defered.promise;
    };

    // 打包文件
    var secondStep = function() {
        var defered = Q.defer();
        process.stdout.write(colors.green('2、: build -> \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 build project...\n'));
        //在命令行执行一个命令npm run build；只处理的src中的文件；
        exec('npm run build', function(error, stdout, stderr) {
            process.stdout.write(colors.green('\x20\x20\x20 success\n'));
            defered.resolve(true);
        });
        return defered.promise;
    };

    // 处理目标文件: 将static中的文件写入dist；
    var thirdStep = function() {
        var defered = Q.defer();
        process.stdout.write(colors.green('3、: copy -> \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 copy project...\n'));
        //将static中的所有内容全部写入dist/static;相当于只处理了static中的将static中的文件写入；
        gulp.src('static/**')
            .pipe(gulp.dest('dist/static'))
            .on('finish', function() {
                process.stdout.write(colors.green('\x20\x20\x20 success\n'));
                defered.resolve(true);
            })
            .on('error', function(error) {
                process.stdout.write(colors.red('\x20\x20\x20 field !\n'));
                defered.reject(new Error(error));
            });
        return defered.promise;
    };

    // 处理图片
    var forthStep = function() {
        var defered = Q.defer();
        process.stdout.write(colors.green('4、: pngquant -> \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 pngquant (png|jpg|gif)...\n'));
        gulp.src([
                '!dist/static/js',
                '!dist/static/css',
                '!dist/static/lib',
                'dist/static/*/*.{png,jpg,gif,ico}'
            ]).pipe(imagemin({
                optimizationLevel: 7, //类型：Number  默认：3  取值范围：0-7（优化等级）
                progressive: true, //类型：Boolean 默认：false 无损压缩jpg图片
                interlaced: true, //类型：Boolean 默认：false 隔行扫描gif进行渲染
                multipass: true, //类型：Boolean 默认：false 多次优化svg直到完全优化
                svgoPlugins: [{
                    removeViewBox: false
                }], //不要移除svg的viewbox属性
                use: [pngquant()] //使用pngquant深度压缩png图片的imagemin插件
            }))
            .pipe(gulp.dest('dist/static'))
            .on('finish', function() {
                process.stdout.write(colors.blue('\x20\x20\x20 success\n'));
                defered.resolve(true);
            })
            .on('error', function(error) {
                process.stdout.write(colors.red('\x20\x20\x20 field !\n'));
                defered.reject(new Error(error));
            });
        return defered.promise;
    };

    // 拷贝首页文件：既是与main同级的index.html;将index.html拷贝到dist文件夹；
    var fifthStep = function() {
        var defered = Q.defer();
        process.stdout.write(colors.green('5、: index -> \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 copy index...\n'));
        //在这里拷贝了index.html
        gulp.src(['src/index.html'])
            .pipe(gulp.dest('dist'))
            .on('finish', function() {
                process.stdout.write(colors.blue('\x20\x20\x20 success\n'));
                defered.resolve(true);
            })
            .on('error', function(error) {
                process.stdout.write(colors.red('\x20\x20\x20 field !\n'));
                defered.reject(new Error(error));
            });
        return defered.promise;
    };

    // 打包前准备：将dist目录下的所有文件写入dist/app-xj；
    //将dist目录下的所有，写入dist/app-xj；
    var sixthStep = function() {
        var defered = Q.defer();
        process.stdout.write(colors.green('6、: app -> \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 new app...\n'));
        //将dist目录下的所有文件全部写入dist/app-xj
        gulp.src('dist/**')
            .pipe(gulp.dest('dist/' + O))
            .on('finish', function() {
                process.stdout.write(colors.blue('\x20\x20\x20 success\n'));
                defered.resolve(true);
            })
            .on('error', function(error) {
                process.stdout.write(colors.red('\x20\x20\x20 field !\n'));
                defered.reject(new Error(error));
            });
        return defered.promise;
    };

    // 打包前准备：将static中的img打包到dist/app-xj/static/img
    var sixdotfiveStep = function() {
        var defered = Q.defer();
        process.stdout.write(colors.green('6.5、: img -> \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 cp img...\n'));
        gulp.src('dist/static/img/**')
            .pipe(gulp.dest('dist/' + O + '/static/css/static/img'))
            .on('finish', function() {
                process.stdout.write(colors.blue('\x20\x20\x20 success\n'));
                defered.resolve(true);
            })
            .on('error', function(error) {
                process.stdout.write(colors.red('\x20\x20\x20 field !\n'));
                defered.reject(new Error(error));
            });
        return defered.promise;
    };

    // 打包目标文件
    var seventhStep = function() {
        var defered = Q.defer();
        process.stdout.write(colors.green('7、: zip -> \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 zip packing...\n'));
        gulp.src([
            'dist/**',
            '!dist/index.html',
            '!dist/icons-*/**',
            '!dist/static/**/*'
            ])
            .pipe(zip(zipfile))
            .pipe(gulp.dest('dist'))
            .on('finish', function() {
                process.stdout.write(colors.blue('\x20\x20\x20 success\n'));
                defered.resolve(zipfile);
            })
            .on('error', function(error) {
                process.stdout.write(colors.red('\x20\x20\x20 field !\n'));
                defered.reject(new Error(error));
            });
        return defered.promise;
    };

    // 将打包文件上传至中控
    var eighthStep = function(file) {
        //file是打包后得文件；
        var defered = Q.defer();
        process.stdout.write(colors.green('8、upload: \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 upload ' + file + ' to ' + IPs[0].host + '...\n'));
        //连接中控得时候拿到本地压缩得文件，上传中控的账户信息；
        exec('scp ./dist/' + file + ' ' + IPs[0].user + '@' + IPs[0].host + ':' + IPs[0].dist, function(error, stdout, stderr) {
            process.stdout.write(colors.blue('\x20\x20\x20 upload to ' + IPs[0].host + ' success\n'));
            defered.resolve(file);
        });
        return defered.promise;
    };

    // 连接中控机
    var ninthStep = function(file) {
        var defered = Q.defer();
        //登陆连接；
        process.stdout.write(colors.green('9、login: \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 login ' + IPs[0].host + '...\n'));
        //连接到服务器；接收5个参数；
        //host服务器的ip地址；port：端口号；username:用户名；password：账号密码；privateKey：私钥；这个主要是自己的，也就是上传到服务器的个人信息；
        center.connect({
            host: IPs[0].host,
            port: IPs[0].port,
            username: IPs[0].user,
            privateKey: IPs[0].privateKey
        }).then(function() {
            process.stdout.write(colors.blue('\x20\x20\x20 welcome to ' + IPs[0].host + '!\n'));
            //连接成功之后，可以对中控上的文件做操作；这时候上传到中控的文件是压缩后的文件，需要解压文件；
            defered.resolve(file);
        });
        return defered.promise;
    };

    // 解压文件：解压上传到服务器上的压缩后的文件；
    var tenthStep = function(file) {
        var defered = Q.defer();
        process.stdout.write(colors.green('10、unzip: \n'));
        //执行shell命令
        center.exec('unzip -o ' + IPs[0].dist + '/' + file)
            .then(function(result) {
                process.stdout.write(colors.blue('\x20\x20\x20 success\n'));
                defered.resolve(file);
            });
        return defered.promise;
    };

    // 将文件拷贝到服务器
    var eleventhStep = function(file) {
        var defered = Q.defer();
        process.stdout.write(colors.green('11、copy: \n'));
        process.stdout.write(colors.blue('\x20\x20\x20 copy ' + O + ' to ' + IPs[1].host + '!\n'));
        center.exec('scp -r ' + IPs[0].dist + '/' + O + ' ' + IPs[1].host + ':' + IPs[1].dist)
            .then(function(result) {
                process.stdout.write(colors.blue('\x20\x20\x20 success\n'));
                defered.resolve(file);
            });
        return defered.promise;
    };

    // 删除打包文件
    var twelfthStep = function(file) {
        var defered = Q.defer();
        process.stdout.write(colors.green('12、del: \n'));
        center.exec('rm -rf ' + file + ' ' + O + '/').then(function(result) {
            process.stdout.write(colors.blue('\x20\x20\x20 success\n'));
            defered.resolve(true);
        });
        return defered.promise;
    };

    // 成功提示
    var thirteenthStep = function() {
        var defered = Q.defer();
        center.dispose();
        process.stdout.write(colors.green('\x20PUBLISH SUCCESS\n'));
        defered.resolve(true);
        return defered.promise;
    };

    // 错误统一处理
    var error_catch = function(error) {
        process.stdout.write(colors.red('Field!\n'));
        process.stdout.write(colors.red(error.message + '\n'));
    };

    Q.fcall(firstStep)
        .then(secondStep) 
        .then(thirdStep)
        // .then(forthStep)  //对图片处理，多目录太耗时，先注释掉
        .then(fifthStep)
        .then(sixthStep)
        .then(sixdotfiveStep)
        .then(seventhStep)
        .then(eighthStep)
        .then(ninthStep)
        .then(tenthStep)
        .then(eleventhStep)
        .then(twelfthStep)
        .then(thirteenthStep)
        .catch(error_catch)
        .done();
}();