@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
title SalesAll MVNO deploy
cd /d "%~dp0"

rem ==========================================================================
rem  push.cmd - SalesAll MVNO project portal: GitHub push + Cloudflare D1
rem
rem  Usage (PowerShell: prefix with .\)
rem    .\push.cmd init            first deploy: npm install, wrangler login,
rem                               D1 create + wrangler.toml id + migrations,
rem                               then commit / tag v1.0.0 / push
rem    .\push.cmd                 patch bump  (v1.0.0 - v1.0.1)
rem    .\push.cmd minor           minor bump  (v1.0.1 - v1.1.0)
rem    .\push.cmd major           major bump  (v1.1.0 - v2.0.0)
rem    .\push.cmd "message"       custom commit subject
rem    .\push.cmd minor -y        skip confirmation
rem
rem  Each run : auto commit message (version, areas, file list),
rem             docs\deploy-history.md row, version tag,
rem             remote D1 migration apply when migrations\*.sql added
rem  Note     : Cloudflare Pages rebuilds from GitHub main automatically
rem  Note     : keep these header comments ASCII-only (UTF-8 + chcp 65001
rem             shifts cmd line parsing on multibyte comment lines)
rem ==========================================================================

set "REMOTE_URL=https://github.com/jiwonida-dotcom/SalesAll.git"
set "REPO_WEB=https://github.com/jiwonida-dotcom/SalesAll"
set "BRANCH=main"
set "FIRST_VERSION=v1.0.0"
set "DB_NAME=salesall-db"
set "DB_PLACEHOLDER=REPLACE_WITH_D1_DATABASE_ID"
set "HIST_FILE=docs\deploy-history.md"
set "MSG_FILE=%TEMP%\salesall_commit_msg.txt"
set "TMP_OUT=%TEMP%\salesall_wrangler_out.txt"

rem ---------- args ----------
set "BUMP=patch"
set "NOTE="
set "AUTO="
set "INIT="
:args
if "%~1"=="" goto :args_done
set "ARG=%~1"
if "!ARG!"=="/?" goto :help
if /i "!ARG!"=="help" goto :help
if /i "!ARG!"=="init" set "INIT=1" & goto :args_next
if /i "!ARG!"=="major" set "BUMP=major" & goto :args_next
if /i "!ARG!"=="minor" set "BUMP=minor" & goto :args_next
if /i "!ARG!"=="patch" set "BUMP=patch" & goto :args_next
if /i "!ARG!"=="-y" set "AUTO=1" & goto :args_next
set "NOTE=!ARG!"
:args_next
shift
goto :args
:args_done

echo ============================================
echo  SalesAll MVNO 프로젝트 관리 웹 배포
if defined INIT echo  모드: 첫 배포 (Cloudflare D1 초기 셋팅 포함)
echo ============================================

rem ---------- 1. tool check ----------
where git >nul 2>&1
if errorlevel 1 (
  echo [오류] git 미설치. https://git-scm.com/download/win 설치 후 재실행하세요.
  goto :fail
)

set "DB_READY=1"
findstr /c:"%DB_PLACEHOLDER%" wrangler.toml >nul 2>&1
if not errorlevel 1 set "DB_READY=0"

if defined INIT goto :cf_init
if "%DB_READY%"=="0" (
  echo [안내] wrangler.toml D1 database_id 미설정. 첫 배포는 "push.cmd init" 으로 실행하세요.
  echo        D1 셋팅 없이 GitHub 푸시만 진행합니다.
)
goto :git_flow

rem ==========================================================================
rem  Cloudflare first-deploy setup
rem ==========================================================================
:cf_init
where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 미설치. https://nodejs.org 에서 LTS 설치 후 재실행하세요.
  goto :fail
)

echo.
echo [1/4] 패키지 설치 (wrangler)
if not exist "node_modules\wrangler" (
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo [오류] npm install 실패.
    goto :fail
  )
) else (
  echo        설치됨 - 생략
)

echo.
echo [2/4] Cloudflare 로그인 확인
call npx wrangler whoami > "%TMP_OUT%" 2>&1
findstr /i /c:"not authenticated" /c:"You are not logged in" "%TMP_OUT%" >nul
if not errorlevel 1 (
  echo        로그인 필요 - 브라우저에서 Cloudflare 계정 승인
  call npx wrangler login
  if errorlevel 1 (
    echo [오류] wrangler login 실패.
    goto :fail
  )
) else (
  echo        로그인됨
)

echo.
echo [3/4] D1 데이터베이스 %DB_NAME%
if "%DB_READY%"=="1" (
  echo        wrangler.toml database_id 설정됨 - 생략
  goto :cf_migrate
)
set "DBID="
rem CI=true keeps wrangler non-interactive while output is redirected
set "CI=true"
call npx wrangler d1 create %DB_NAME% > "%TMP_OUT%" 2>&1
type "%TMP_OUT%"
for /f "delims=" %%i in ('powershell -NoProfile -Command "$t=Get-Content -Raw '%TMP_OUT%'; if($t -match 'database_id\W+([0-9a-fA-F-]{36})'){$matches[1]}"') do set "DBID=%%i"
if not defined DBID (
  echo        신규 생성 실패 - 기존 D1 목록에서 %DB_NAME% 조회
  call npx wrangler d1 list --json > "%TMP_OUT%" 2>nul
  for /f "delims=" %%i in ('powershell -NoProfile -Command "try{$j=Get-Content -Raw '%TMP_OUT%' | ConvertFrom-Json; ($j | Where-Object { $_.name -eq '%DB_NAME%' } | Select-Object -First 1).uuid}catch{}"') do set "DBID=%%i"
)
set "CI="
if not defined DBID (
  echo [오류] D1 database_id 확인 실패. Cloudflare 대시보드 Workers ^& Pages - D1 에서 확인 후 wrangler.toml 에 직접 입력하세요.
  goto :fail
)
set "CI="
echo        database_id: %DBID%
powershell -NoProfile -Command "$p=Join-Path (Get-Location) 'wrangler.toml'; $t=[IO.File]::ReadAllText($p); [IO.File]::WriteAllText($p, $t.Replace('%DB_PLACEHOLDER%','%DBID%'), (New-Object Text.UTF8Encoding $false))"
if errorlevel 1 goto :fail
echo        wrangler.toml 반영 완료
set "DB_READY=1"

:cf_migrate
echo.
echo [4/4] D1 마이그레이션 적용 (원격)
call npx wrangler d1 migrations apply %DB_NAME% --remote
if errorlevel 1 (
  echo [오류] 마이그레이션 실패. 위 메시지 확인 후 재실행하세요.
  goto :fail
)
set "MIG_DONE=1"

rem ==========================================================================
rem  GitHub flow
rem ==========================================================================
:git_flow
echo.

rem ---------- 2. repo init / remote ----------
if not exist ".git" (
  echo [초기화] git 저장소 생성
  git init -q
  if errorlevel 1 goto :fail
)
git config core.quotepath false

set "HAS_HEAD=1"
git rev-parse -q --verify HEAD >nul 2>&1
if errorlevel 1 set "HAS_HEAD=0"
if "%HAS_HEAD%"=="0" git symbolic-ref HEAD refs/heads/%BRANCH%

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REMOTE_URL%"
  echo [초기화] 원격 저장소 연결
)
for /f "delims=" %%u in ('git remote get-url origin') do set "CUR_REMOTE=%%u"
echo 원격 저장소: %CUR_REMOTE%

rem ---------- 3. commit author ----------
set "GUN="
for /f "delims=" %%a in ('git config user.name 2^>nul') do set "GUN=%%a"
if not defined GUN (
  set /p "GUN=커밋 작성자 이름 입력: "
  git config user.name "!GUN!"
)
set "GUE="
for /f "delims=" %%a in ('git config user.email 2^>nul') do set "GUE=%%a"
if not defined GUE (
  set /p "GUE=커밋 작성자 이메일 입력: "
  git config user.email "!GUE!"
)

rem ---------- 4. remote state ----------
echo 원격 저장소 확인 중...
git fetch -q --tags origin
if errorlevel 1 (
  echo [오류] 원격 저장소 접근 실패. 네트워크, 저장소 생성 여부, GitHub 로그인 계정 권한을 확인하세요.
  goto :fail
)
set "REMOTE_HAS=0"
git rev-parse -q --verify "refs/remotes/origin/%BRANCH%" >nul 2>&1
if not errorlevel 1 set "REMOTE_HAS=1"

if "%HAS_HEAD%"=="0" if "%REMOTE_HAS%"=="1" (
  echo [초기화] 원격 main 기록 기준으로 로컬 파일 반영
  git reset -q "origin/%BRANCH%"
)

set "LAST_TAG="
for /f "delims=" %%t in ('git tag -l "v*" --sort=-v:refname 2^>nul') do if not defined LAST_TAG set "LAST_TAG=%%t"

rem ---------- 5. stage changes / secret check ----------
git add -A
if errorlevel 1 goto :fail

git diff --cached --name-only | findstr /i /r /c:"\.dev\.vars" /c:"node_modules/" /c:"\.wrangler/" /c:"\.key$" /c:"credentials.*\.json" >nul
if not errorlevel 1 (
  echo [중단] 커밋 제외 대상 파일 감지. 커밋하지 않습니다.
  git diff --cached --name-only | findstr /i /r /c:"\.dev\.vars" /c:"node_modules/" /c:"\.wrangler/" /c:"\.key$" /c:"credentials.*\.json"
  git reset -q >nul 2>&1
  goto :fail
)
git grep --cached -l -I -e "BEGIN PRIVATE KEY" -e "CLOUDFLARE_API_TOKEN=" -- . ":(exclude)push.cmd" >nul 2>&1
if not errorlevel 1 (
  echo [중단] 키·토큰이 포함된 파일 감지. 커밋하지 않습니다.
  git grep --cached -l -I -e "BEGIN PRIVATE KEY" -e "CLOUDFLARE_API_TOKEN=" -- . ":(exclude)push.cmd"
  git reset -q >nul 2>&1
  goto :fail
)

set "HAS_CHANGES=1"
git diff --cached --quiet
if not errorlevel 1 set "HAS_CHANGES=0"

rem first deploy with existing local commits and no changes: tag HEAD as v1.0.0
if "%HAS_CHANGES%"=="0" if not defined LAST_TAG if "%HAS_HEAD%"=="1" goto :first_tag_only
if "%HAS_CHANGES%"=="0" goto :no_changes

rem ---------- 6. version ----------
set "IS_FIRST=0"
if not defined LAST_TAG (
  set "IS_FIRST=1"
  set "VERSION=%FIRST_VERSION%"
  set "PREV=없음"
) else (
  set "PREV=!LAST_TAG!"
  for /f "tokens=1-3 delims=v." %%a in ("!LAST_TAG!") do set /a MA=%%a, MI=%%b, PA=%%c
  if /i "%BUMP%"=="major" (set /a MA+=1, MI=0, PA=0) else if /i "%BUMP%"=="minor" (set /a MI+=1, PA=0) else (set /a PA+=1)
  set "VERSION=v!MA!.!MI!.!PA!"
)
git rev-parse -q --verify "refs/tags/%VERSION%" >nul 2>&1
if not errorlevel 1 (
  echo [오류] 태그 %VERSION% 이미 존재. 버전 인자를 확인하세요.
  git reset -q >nul 2>&1
  goto :fail
)

rem ---------- 7. change analysis ----------
set /a CA=0, CM=0, CD=0, CR=0, CNT=0
set "NEW_MIG="
for %%v in (AR_UI AR_DATA AR_GUIDE AR_API AR_MIG AR_SEED AR_DOC AR_DEPLOY AR_ETC) do set "%%v="
for /f "tokens=1,2" %%s in ('git diff --cached --name-status') do (
  set "ST=%%s"
  set "P=%%t"
  set /a CNT+=1
  if "!ST:~0,1!"=="A" set /a CA+=1
  if "!ST:~0,1!"=="M" set /a CM+=1
  if "!ST:~0,1!"=="D" set /a CD+=1
  if "!ST:~0,1!"=="R" set /a CR+=1
  if "!P:~0,11!"=="migrations/" if "!ST:~0,1!"=="A" set "NEW_MIG=1"
  if "!P:~0,12!"=="public/data/" (set "AR_DATA=1"
  ) else if "!P:~0,13!"=="public/guide/" (set "AR_GUIDE=1"
  ) else if "!P:~0,7!"=="public/" (set "AR_UI=1"
  ) else if "!P:~0,10!"=="functions/" (set "AR_API=1"
  ) else if "!P:~0,11!"=="migrations/" (set "AR_MIG=1"
  ) else if "!P:~0,5!"=="seed/" (set "AR_SEED=1"
  ) else if "!P:~0,8!"=="scripts/" (set "AR_SEED=1"
  ) else if /i "!P!"=="push.cmd" (set "AR_DEPLOY=1"
  ) else if /i "!P!"=="wrangler.toml" (set "AR_DEPLOY=1"
  ) else if /i "!P!"=="docs/deploy-history.md" (set "AR_DEPLOY=1"
  ) else if /i "!P:~-3!"==".md" (set "AR_DOC=1"
  ) else (set "AR_ETC=1")
)

set "AREAS="
if defined AR_UI set "AREAS=!AREAS!웹 화면, "
if defined AR_DATA set "AREAS=!AREAS!정적 콘텐츠, "
if defined AR_GUIDE set "AREAS=!AREAS!가이드 이미지, "
if defined AR_API set "AREAS=!AREAS!API, "
if defined AR_MIG set "AREAS=!AREAS!D1 마이그레이션, "
if defined AR_SEED set "AREAS=!AREAS!초기 데이터, "
if defined AR_DEPLOY set "AREAS=!AREAS!배포 설정, "
if defined AR_DOC set "AREAS=!AREAS!문서, "
if defined AR_ETC set "AREAS=!AREAS!기타 설정, "
if defined AREAS set "AREAS=!AREAS:~0,-2!"

set "VERB=수정"
if %CM%==0 if %CD%==0 if %CR%==0 set "VERB=추가"
if %CA%==0 if %CM%==0 if %CR%==0 set "VERB=삭제"

for /f "delims=" %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH:mm"') do set "NOW=%%d"
set "NOW=!NOW:_= !"

rem ---------- 8. commit message ----------
if defined NOTE (
  set "SUBJECT=[%VERSION%] !NOTE!"
) else if "%IS_FIRST%"=="1" (
  set "SUBJECT=[%VERSION%] 최초 배포: SalesAll MVNO 프로젝트 관리 웹 초기 구성"
) else (
  set "SUBJECT=[%VERSION%] !AREAS! !VERB!"
)

> "%MSG_FILE%" echo !SUBJECT!
>>"%MSG_FILE%" echo(
>>"%MSG_FILE%" echo 배포 버전: %VERSION%
>>"%MSG_FILE%" echo 이전 버전: %PREV%
>>"%MSG_FILE%" echo 배포 일시: %NOW% KST
>>"%MSG_FILE%" echo 변경 영역: !AREAS!
>>"%MSG_FILE%" echo 변경 파일: 총 %CNT%개 / 추가 %CA% · 수정 %CM% · 삭제 %CD% · 이름 변경 %CR%
if defined NEW_MIG >>"%MSG_FILE%" echo D1 마이그레이션: 신규 파일 포함 - 원격 적용 필요
if defined MIG_DONE >>"%MSG_FILE%" echo D1 마이그레이션: 원격 적용 완료 - 첫 배포 셋팅
>>"%MSG_FILE%" echo(
>>"%MSG_FILE%" echo [변경 파일 목록] A=추가 M=수정 D=삭제 R=이름 변경
git diff --cached --name-status >> "%MSG_FILE%"

echo.
echo -------------- 배포 메시지 --------------
type "%MSG_FILE%"
echo -----------------------------------------
echo.

if not defined AUTO (
  choice /c YN /n /m "이 내용으로 커밋 후 GitHub 배포 진행 [Y/N] "
  if errorlevel 2 (
    git reset -q >nul 2>&1
    echo 배포 취소. 변경 파일은 그대로 유지됩니다.
    goto :done
  )
)

rem ---------- 9. deploy history row ----------
if not exist "docs" mkdir "docs"
if not exist "%HIST_FILE%" (
  > "%HIST_FILE%" echo # 배포 이력 — SalesAll MVNO 프로젝트 관리 웹
  >>"%HIST_FILE%" echo(
  >>"%HIST_FILE%" echo push.cmd 실행 시 자동 기록. 오래된 순 누적. 수동 편집 불필요.
  >>"%HIST_FILE%" echo(
  >>"%HIST_FILE%" echo ^| 배포 버전 ^| 배포 일시 ^| 이전 버전 ^| 변경 영역 ^| 변경 파일 ^| 배포자 ^| 제목 ^|
  >>"%HIST_FILE%" echo ^|---^|---^|---^|---^|---^|---^|---^|
)
>>"%HIST_FILE%" echo ^| %VERSION% ^| %NOW% ^| %PREV% ^| !AREAS! ^| %CNT%개 (A%CA% M%CM% D%CD% R%CR%) ^| !GUN! ^| !SUBJECT! ^|
git add -- "%HIST_FILE%"
if errorlevel 1 goto :fail

rem ---------- 10. commit / rebase / tag ----------
git commit -q -F "%MSG_FILE%"
if errorlevel 1 goto :fail
git branch -M %BRANCH%
call :sync_remote
if errorlevel 1 goto :fail
git tag -a "%VERSION%" -F "%MSG_FILE%"
if errorlevel 1 goto :fail
goto :migrate_check

rem ---------- first deploy, no new changes: tag existing HEAD ----------
:first_tag_only
set "VERSION=%FIRST_VERSION%"
for /f "delims=" %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH:mm"') do set "NOW=%%d"
set "NOW=!NOW:_= !"
set "CNT=0"
for /f %%n in ('git rev-list --count HEAD') do set "CNT=%%n"
if defined NOTE (set "SUBJECT=[%VERSION%] !NOTE!") else (set "SUBJECT=[%VERSION%] 최초 배포: SalesAll MVNO 프로젝트 관리 웹 초기 구성")
> "%MSG_FILE%" echo !SUBJECT!
>>"%MSG_FILE%" echo(
>>"%MSG_FILE%" echo 배포 버전: %VERSION%
>>"%MSG_FILE%" echo 이전 버전: 없음
>>"%MSG_FILE%" echo 배포 일시: %NOW% KST
>>"%MSG_FILE%" echo 포함 커밋: 로컬 기존 커밋 %CNT%건
>>"%MSG_FILE%" echo(
>>"%MSG_FILE%" echo [포함 커밋]
git log --oneline >> "%MSG_FILE%"
echo.
echo -------------- 배포 메시지 --------------
type "%MSG_FILE%"
echo -----------------------------------------
echo.
if not defined AUTO (
  choice /c YN /n /m "기존 커밋에 %VERSION% 태그 후 GitHub 배포 진행 [Y/N] "
  if errorlevel 2 (
    echo 배포 취소.
    goto :done
  )
)
if not exist "docs" mkdir "docs"
> "%HIST_FILE%" echo # 배포 이력 — SalesAll MVNO 프로젝트 관리 웹
>>"%HIST_FILE%" echo(
>>"%HIST_FILE%" echo push.cmd 실행 시 자동 기록. 오래된 순 누적. 수동 편집 불필요.
>>"%HIST_FILE%" echo(
>>"%HIST_FILE%" echo ^| 배포 버전 ^| 배포 일시 ^| 이전 버전 ^| 변경 영역 ^| 변경 파일 ^| 배포자 ^| 제목 ^|
>>"%HIST_FILE%" echo ^|---^|---^|---^|---^|---^|---^|---^|
>>"%HIST_FILE%" echo ^| %VERSION% ^| %NOW% ^| 없음 ^| 전체 ^| 기존 커밋 %CNT%건 ^| !GUN! ^| !SUBJECT! ^|
git add -- "%HIST_FILE%"
git commit -q -F "%MSG_FILE%"
if errorlevel 1 goto :fail
git branch -M %BRANCH%
call :sync_remote
if errorlevel 1 goto :fail
git tag -a "%VERSION%" -F "%MSG_FILE%"
if errorlevel 1 goto :fail
goto :migrate_check

rem ---------- no changes: push pending commits only ----------
:no_changes
set "AHEAD=0"
if "%REMOTE_HAS%"=="1" (
  for /f %%n in ('git rev-list --count origin/%BRANCH%..HEAD 2^>nul') do set "AHEAD=%%n"
) else (
  for /f %%n in ('git rev-list --count HEAD 2^>nul') do set "AHEAD=%%n"
)
if "%AHEAD%"=="0" (
  echo 변경 파일 없음. 배포 생략.
  goto :done
)
echo 미푸시 커밋 %AHEAD%개 감지. 푸시만 진행합니다.
set "VERSION=%LAST_TAG%"
goto :push

rem ---------- 11. remote D1 migration (new migrations\*.sql) ----------
:migrate_check
if not defined NEW_MIG goto :push
if defined MIG_DONE goto :push
if "%DB_READY%"=="0" (
  echo [안내] 신규 마이그레이션 포함. D1 미설정 상태라 원격 적용 생략 - "push.cmd init" 실행 필요.
  goto :push
)
echo.
echo 신규 D1 마이그레이션 감지 - 푸시 전 원격 적용 (화면 배포 전 스키마 선반영)
set "DO_MIG=1"
if not defined AUTO (
  choice /c YN /n /m "원격 D1 마이그레이션 적용 [Y/N] "
  if errorlevel 2 set "DO_MIG="
)
if defined DO_MIG (
  if not exist "node_modules\wrangler" call npm install --no-fund --no-audit
  call npx wrangler d1 migrations apply %DB_NAME% --remote
  if errorlevel 1 (
    echo [오류] 마이그레이션 실패. 커밋·태그는 로컬에 유지됩니다. 원인 해결 후 재실행하면 푸시가 이어집니다.
    goto :fail
  )
) else (
  echo [안내] 마이그레이션 미적용. 배포 후 수동 실행: npx wrangler d1 migrations apply %DB_NAME% --remote
)

rem ---------- 12. push ----------
:push
echo.
echo GitHub 푸시 중...
git push -u --follow-tags origin %BRANCH%
if errorlevel 1 (
  echo [오류] 푸시 실패. 커밋과 태그는 로컬에 유지되며, 원인 해결 후 재실행하면 이어서 푸시됩니다.
  goto :fail
)

echo.
echo ============================================
echo  배포 완료: %VERSION%
echo  저장소   : %REPO_WEB%
echo  커밋 기록: %REPO_WEB%/commits/%BRANCH%
echo  배포 이력: %HIST_FILE%
echo  Cloudflare Pages: GitHub main 기준 1~2분 내 자동 재빌드
echo ============================================
if defined INIT call :init_guide
goto :done

rem ---------- helper: rebase onto remote main ----------
:sync_remote
if not "%REMOTE_HAS%"=="1" exit /b 0
echo 원격 변경 반영 중...
git pull -q --rebase origin %BRANCH%
if errorlevel 1 (
  git rebase --abort >nul 2>&1
  echo [오류] 원격 변경과 충돌. 커밋은 로컬에 유지됩니다. 충돌 해결 후 재실행하세요.
  echo        GitHub 저장소 생성 시 README 등을 추가했다면 원격 파일과 충돌할 수 있습니다.
  exit /b 1
)
exit /b 0

rem ---------- helper: dashboard steps after first deploy ----------
:init_guide
echo.
echo ------------- Cloudflare 대시보드 설정 (최초 1회) -------------
echo  1. Workers ^& Pages - Create - Pages - Connect to Git
echo     저장소: jiwonida-dotcom/SalesAll / Branch: main
echo     Framework preset: None / Build command: 비움 / Output: public
echo  2. 프로젝트 Settings - Bindings - D1: 변수명 DB = %DB_NAME%
echo     (Production, Preview 모두) 저장 후 재배포
echo  3. Zero Trust - Access - Applications - Self-hosted
echo     도메인: ^<프로젝트^>.pages.dev
echo     정책: Emails ending in @medialog.co.kr + 외부 참여자 개별 이메일
echo ----------------------------------------------------------------
exit /b 0

:help
echo 사용법: push.cmd [init] [patch^|minor^|major] ["배포 메시지"] [-y]
echo   init   첫 배포. npm install, wrangler login, D1 생성,
echo          wrangler.toml database_id 반영, 원격 마이그레이션 후 v1.0.0 배포
echo   patch  기본값. v1.0.0 - v1.0.1
echo   minor  v1.0.1 - v1.1.0
echo   major  v1.1.0 - v2.0.0
echo   -y     확인 없이 바로 배포
echo   신규 migrations\*.sql 포함 시 푸시 전 원격 D1 적용 여부 확인
goto :done

:fail
if exist "%MSG_FILE%" del "%MSG_FILE%" >nul 2>&1
if exist "%TMP_OUT%" del "%TMP_OUT%" >nul 2>&1
echo.
echo 배포 중단.
if not defined AUTO pause
endlocal
exit /b 1

:done
if exist "%MSG_FILE%" del "%MSG_FILE%" >nul 2>&1
if exist "%TMP_OUT%" del "%TMP_OUT%" >nul 2>&1
if not defined AUTO pause
endlocal
exit /b 0
