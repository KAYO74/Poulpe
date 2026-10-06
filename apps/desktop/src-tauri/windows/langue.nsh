; Installeur Windows (NSIS) : la langue choisie au début de l'installation est aussi celle de l'appli.
; Elle est écrite dans langue.txt, à côté de Poulpe.exe ; l'appli la lit au lancement
; (commande installer_language, voir src/lib.rs et apps/editor/src/startLanguage.ts).

!macro NSIS_HOOK_POSTINSTALL
  Push $0
  Push $1
  StrCpy $1 "en"
  ${If} $LANGUAGE == ${LANG_FRENCH}
    StrCpy $1 "fr"
  ${EndIf}
  FileOpen $0 "$INSTDIR\langue.txt" w
  FileWrite $0 $1
  FileClose $0
  Pop $1
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\langue.txt"
!macroend
